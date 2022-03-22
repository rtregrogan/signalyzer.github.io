const mongoose = require('mongoose');

const tcfcatalog = new mongoose.Schema({
    Catalog: String,
    addedby: String,
    ServerTime: String,
}, { timestamps: { createdAt: 'created_at' } });

const TCFCatalog = mongoose.model('TCFCatalog', tcfcatalog);
module.exports = TCFCatalog;