const mongoose = require('mongoose');

const tcfTaskType = new mongoose.Schema({
    TaskType: String,
    addedby: String,
    ServerTime: String,
}, { timestamps: { createdAt: 'created_at' } });

const TCFTaskType = mongoose.model('TCFTaskType', tcfTaskType);
module.exports = TCFTaskType;