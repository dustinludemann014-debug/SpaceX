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

// 1. Define Schemas (UserSchema unchanged)
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

// 1. Define Schemas (TransactionSchema UPDATED to include walletAddress)
const TransactionSchema = new mongoose.Schema({
    id: { type: String, default: uuidv4, unique: true },
    userId: { type: String, required: true, index: true }, 
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    walletAddress: { type: String }, // <-- NEW FIELD for withdrawals
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

// 1. User Registration 
app.post('/api/register', async (req, res) => {
    const { email, password, username } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newUser = new User({
            email,
            password: hashedPassword,
            username,
            status: 'pending',
        });
        await newUser.save();
        res.json({ success: true, message: 'Registration successful. Waiting for admin approval.', userId: newUser.id });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during registration.', error: error.message });
    }
});

// 2. User Login 
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
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

// 6. User: Submit Transaction (Deposit/Buy/Withdrawal) - UPDATED
app.post('/api/user/transaction', authenticateToken, async (req, res) => {
    const { type, amount, walletAddress } = req.body; // <-- walletAddress included

    if (!['deposit', 'buy', 'withdraw'].includes(type) || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid transaction data.' });
    }

    // New logic for withdrawal validation
    if (type === 'withdraw' && (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 10)) {
        return res.status(400).json({ success: false, message: 'Wallet address is required for withdrawal.' });
    }

    try {
        const user = await User.findOne({ id: req.userId });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        if (user.status !== 'approved') {
            return res.status(403).json({ success: false, message: 'Account must be approved by admin to perform transactions.' });
        }
        
        // Specific check for withdrawal funds availability
        if (type === 'withdraw' && user.balance < amount) {
             return res.status(400).json({ success: false, message: 'Insufficient balance for withdrawal.' });
        }

        const newTransaction = new Transaction({
            userId: req.userId,
            type,
            amount,
            walletAddress: type === 'withdraw' ? walletAddress : undefined, // <-- SAVE walletAddress
            status: 'pending',
        });

        await newTransaction.save();

        res.json({ success: true, message: `Transaction submitted for ${type}.`, transaction: newTransaction });

    } catch (error) {
        console.error("Error submitting transaction:", error);
        res.status(500).json({ success: false, message: 'Server error while submitting transaction.' });
    }
});

// 7. User Dashboard Data (Unchanged)
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
            email: user.email,
            balance: user.balance,
            transactions: userTransactions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching user data.' });
    }
});

// 8. Admin: Approve Transaction (UPDATED for withdrawal logic)
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
        } else if (transaction.type === 'buy' || transaction.type === 'withdraw') { // <-- Handles both Buy and Withdraw
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

// 9. User Password Reset (Unchanged)
app.post('/api/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ success: false, message: 'Email and new password are required.' });
    }
    if (newPassword.length < 8) {
         return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        const user = await User.findOneAndUpdate(
            { email: email }, 
            { password: hashedPassword },
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

// 10. User: Update Profile (Unchanged)
app.put('/api/user/update', authenticateToken, async (req, res) => {
    const { username } = req.body;
    const userId = req.userId;
    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    try {
        const user = await User.findOneAndUpdate(
            { id: userId },
            { username: username },
            { new: true } 
        ).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, message: 'Profile updated successfully.', user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating profile.' });
    }
});

// 11. User: Change Password (Unchanged)
app.post('/api/user/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.userId;
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
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid current password.' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        user.password = hashedPassword;
        await user.save();
        res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating password.' });
    }
});


// --- Initial Data Function (Unchanged) ---
async function createInitialData() {
    try {
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('Database already populated. Skipping initial data creation.');
            return;
        }

        console.log('No users found. Creating initial demo data...');
        
        const adminPass = await bcrypt.hash('adminpassword', saltRounds);
        const userPass = await bcrypt.hash('userpassword', saltRounds);

        const adminUser = new User({
            id: "admin-demo-123",
            email: "admin@example.com",
            password: adminPass,
            username: "Admin User",
            userType: "admin",
            status: "approved",
            balance: 100000.00
        });

        const demoUser = new User({
            id: "user-demo-456",
            email: "user@example.com",
            password: userPass,
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
