const mongoose = require('mongoose');

const tcfentries = new mongoose.Schema({
    ShiftDate: String,
    TaskType: String,
    Project: String,
    Catalog: String,
    Hrs: Number,
    Min: Number,
    Sec: Number,
    TotalHrs: Number,
    Status: String,
    AssignedBy: String,
    BillingType: String,
    addedby: String,
    ServerTime: String,
}, { timestamps: { createdAt: 'created_at' } });

const TCFEntries = mongoose.model('TCFEntries', tcfentries);
module.exports = TCFEntries;