// Node.js Backend Server - server.js
// --- REFACTORED FOR MONGODB & BCRYPT PASSWORD HASHING ---

require('dotenv').config(); // <-- ADD THIS LINE FIRST
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // <-- IMPORT BCRYPT
const path = require('path');

const app = express();
const PORT = process.env.PORT || 1000;
const saltRounds = 10; // Standard number of salt rounds for bcrypt

// --- Mongoose/MongoDB Configuration ---

// 1. Define Schemas (Unchanged)
const UserSchema = new mongoose.Schema({
    id: { type: String, default: uuidv4, unique: true, index: true }, 
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // This will now store the HASH
    username: { type: String, required: true },
    userType: { type: String, default: 'user' },
    status: { type: String, default: 'pending' },
    balance: { type: Number, default: 0.00 },
    createdAt: { type: Date, default: Date.now },
});

const TransactionSchema = new mongoose.Schema({
    id: { type: String, default: uuidv4, unique: true },
    userId: { type: String, required: true, index: true }, 
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    date: { type: Date, default: Date.now },
    approvedAt: { type: Date },
});

// 2. Create Models (Unchanged)
const User = mongoose.model('User', UserSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

// 3. Connect to MongoDB Atlas (Unchanged)
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB Atlas');
        createInitialData(); 
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err.message);
    });

// --- Middleware (Unchanged) ---
app.use(bodyParser.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
app.use(express.static(__dirname));

// --- Authentication Middleware (Unchanged) ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        req.userId = authHeader.split(' ')[1];
        next();
    } else {
        res.status(401).send({ message: 'Access Denied: No Token Provided' });
    }
};

const adminGate = async (req, res, next) => {
    try {
        const user = await User.findOne({ id: req.userId }); 
        if (user && user.userType === 'admin') {
            next();
        } else {
            res.status(403).send({ message: 'Access Denied: Admin Required' });
        }
    } catch (error) {
        res.status(500).send({ message: 'Error checking admin status' });
    }
};

// --- API Endpoints (Refactored for Bcrypt) ---

// 1. User Registration (NOW HASHES PASSWORD)
app.post('/api/register', async (req, res) => {
    const { email, password, username } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists.' });
        }

        // --- BCRYPT HASHING ---
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        // ---

        const newUser = new User({
            email,
            password: hashedPassword, // Save the hashed password
            username,
            status: 'pending',
        });

        await newUser.save();

        res.json({ success: true, message: 'Registration successful. Waiting for admin approval.', userId: newUser.id });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during registration.', error: error.message });
    }
});

// 2. User Login (NOW COMPARES HASH)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // Find user by email ONLY
        const user = await User.findOne({ email });

        if (!user) {
            // Use a generic message to prevent attackers from knowing if an email exists
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // --- BCRYPT COMPARE ---
        // Compare the provided password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
        // ---

        if (user.status !== 'approved' && user.userType !== 'admin') {
            return res.status(403).json({ success: false, message: 'Account is pending approval.' });
        }
        
        const token = user.id;

        res.json({ 
            success: true, 
            message: 'Login successful.', 
            token, 
            userType: user.userType,
            username: user.username,
            userId: user.id
        });
    } catch (error) {
         res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// 3. Admin Dashboard Data (Unchanged)
app.get('/api/admin/data', authenticateToken, adminGate, async (req, res) => {
    try {
        const users = await User.find().select('-password'); 
        const transactions = await Transaction.find().sort({ date: -1 }); 

        res.json({ users, transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching admin data.' });
    }
});

// 4. Admin: Approve New User (Unchanged)
app.post('/api/admin/approve-user', authenticateToken, adminGate, async (req, res) => {
    const { userId } = req.body;
    try {
        const user = await User.findOneAndUpdate(
            { id: userId }, 
            { status: 'approved' },
            { new: true } 
        );
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, message: 'User approved.', user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error approving user.' });
    }
});

// 5. Admin: Edit Balance (Unchanged)
app.post('/api/admin/update-balance', authenticateToken, adminGate, async (req, res) => {
    const { userId, newBalance } = req.body;
    const balance = parseFloat(newBalance);

    if (isNaN(balance) || balance < 0) {
        return res.status(400).json({ success: false, message: 'Invalid balance amount.' });
    }
    try {
        const user = await User.findOneAndUpdate(
            { id: userId }, 
            { balance: balance },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, message: 'Balance updated.', user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating balance.' });
    }
});

// 6. User: Create Transaction (Unchanged)
app.post('/api/user/transaction', authenticateToken, async (req, res) => {
    const { type, amount } = req.body;
    const userId = req.userId;
    const value = parseFloat(amount);

    if (isNaN(value) || value <= 0 || !['deposit', 'buy'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid transaction data.' });
    }
    try {
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const newTransaction = new Transaction({
            userId,
            type,
            amount: value,
            status: 'pending',
        });
        await newTransaction.save();
        res.json({ success: true, message: 'Transaction submitted for approval.', transaction: newTransaction });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating transaction.' });
    }
});

// 7. User Dashboard Data (*** MODIFIED TO INCLUDE EMAIL ***)
app.get('/api/user/data', authenticateToken, async (req, res) => {
    const userId = req.userId; 
    try {
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' }); 
        }
        const userTransactions = await Transaction.find({ userId: userId }).sort({ date: -1 });
        res.json({
            success: true,
            username: user.username,
            email: user.email, // <-- ADDED THIS LINE
            balance: user.balance,
            transactions: userTransactions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching user data.' });
    }
});

// 8. Admin: Approve Transaction (Unchanged)
app.post('/api/admin/approve-transaction', authenticateToken, adminGate, async (req, res) => {
    const { transactionId } = req.body; 
    try {
        const transaction = await Transaction.findOne({ id: transactionId });
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found.' });
        }
        if (transaction.status === 'complete') {
            return res.status(400).json({ success: false, message: 'Transaction already complete.' });
        }
        const user = await User.findOne({ id: transaction.userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User for transaction not found.' });
        }
        
        if (transaction.type === 'deposit') {
            user.balance += transaction.amount;
        } else if (transaction.type === 'buy') {
            if (user.balance < transaction.amount) {
                return res.status(400).json({ success: false, message: 'Insufficient balance to approve transaction.' });
            }
            user.balance -= transaction.amount;
        }
        
        transaction.status = 'complete';
        transaction.approvedAt = new Date();
        await user.save();
        await transaction.save();
        res.json({ success: true, message: 'Transaction approved and balance updated.', transaction, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error approving transaction.' });
    }
});

// 9. User Password Reset (NOW HASHES NEW PASSWORD)
app.post('/api/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ success: false, message: 'Email and new password are required.' });
    }
    if (newPassword.length < 8) {
         return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    try {
        // --- BCRYPT HASHING ---
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        // ---

        const user = await User.findOneAndUpdate(
            { email: email }, 
            { password: hashedPassword }, // Save the new hashed password
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User with that email was not found.' });
        }

        res.json({ success: true, message: 'Password has been updated successfully.' });
    } catch (error) {
         res.status(500).json({ success: false, message: 'Error resetting password.' });
    }
});

// --- *** NEW ENDPOINT #10 *** ---
// 10. User: Update Profile (Username)
app.put('/api/user/update', authenticateToken, async (req, res) => {
    const { username } = req.body;
    const userId = req.userId; // Get user ID from auth token

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    try {
        const user = await User.findOneAndUpdate(
            { id: userId },
            { username: username },
            { new: true } // Return the updated document
        ).select('-password'); // Exclude password from the response

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({ success: true, message: 'Profile updated successfully.', user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating profile.' });
    }
});

// --- *** NEW ENDPOINT #11 *** ---
// 11. User: Change Password (Authenticated)
app.post('/api/user/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.userId; // Get user ID from auth token

    // --- Validation ---
    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, message: 'All password fields are required.' });
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }
    if (newPassword.length < 8) {
         return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    try {
        // 1. Find the user
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // 2. Compare the *current* password with the hash in the DB
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid current password.' });
        }

        // 3. Hash the *new* password
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // 4. Save the new password
        user.password = hashedPassword;
        await user.save();

        res.json({ success: true, message: 'Password updated successfully.' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating password.' });
    }
});


// --- Initial Data Function (NOW HASHES DEMO PASSWORDS) ---
async function createInitialData() {
    try {
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('Database already populated. Skipping initial data creation.');
            return;
        }

        console.log('No users found. Creating initial demo data...');
        
        // Hash the demo passwords
        const adminPass = await bcrypt.hash('adminpassword', saltRounds);
        const userPass = await bcrypt.hash('userpassword', saltRounds);

        const adminUser = new User({
            id: "admin-demo-123",
            email: "admin@example.com",
            password: adminPass, // Store hashed password
            username: "Admin User",
            userType: "admin",
            status: "approved",
            balance: 100000.00
        });

        const demoUser = new User({
            id: "user-demo-456",
            email: "user@example.com",
            password: userPass, // Store hashed password
            username: "Demo User",
            userType: "user",
            status: "approved",
            balance: 5432.10
        });

        await User.insertMany([adminUser, demoUser]);
        console.log('Created initial admin and demo users with HASHED passwords.');

    } catch (error) {
        console.error('Error creating initial data:', error.message);
    }
}

// Start Server (Unchanged)
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
