const mongoose = require('mongoose');

const apiAccessSchema = new mongoose.Schema({
    access_token: String,
    subscriber_number: String,
}, { timestamps: { createdAt: 'created_at' } });

const apiAccess = mongoose.model('APIAccess', apiAccessSchema);
module.exports = apiAccess;