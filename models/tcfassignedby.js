const mongoose = require('mongoose');

const tcfassignedby = new mongoose.Schema({
    Assigned: String,
    addedby: String,
    ServerTime: String,
}, { timestamps: { createdAt: 'created_at' } });

const TCFAssignedBy = mongoose.model('TCFAssignedBy', tcfassignedby);
module.exports = TCFAssignedBy;