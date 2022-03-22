const express = require('express');
const router = express.Router();
const momenttz = require('moment-timezone');

const TCFTaskType = require('../models/tcftasktype');
const TCFCatalog = require('../models/tcfcatalog');
const TCFAssignedBy = require('../models/tcfassignedby');

router.post('/addtasktype', async (req, res) => {
    try {
        if(req.session.user_id){
            let Manila = momenttz.tz(new Date(), "Asia/Manila");
            let servertime = Manila.format('L LTS')
            const tasktype = new TCFTaskType({
                TaskType: req.body.TaskTypeEntry,
                addedby: req.session.user_id,
                ServerTime: servertime
            })
            await tasktype.save()
            res.send(tasktype)
        } else {
            req.session.user_id = null;
            res.redirect('/');
        }
    } catch (err){
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }

    console.log(req.body.TaskTypeEntry)
})

router.delete('/deletetasktype', async (req, res) => {
    try {
        if(req.session.user_id){
            console.log(req.body.TaskTypetoDelete)
            await TCFTaskType.findOneAndDelete({TaskType: req.body.TaskTypetoDelete})
            res.send({
                deletedtasktype: req.body.TaskTypetoDelete
            })
        } else {
            req.session.user_id = null;
            res.redirect('/');
        }
    } catch (err){
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})


router.post('/addcatalog', async (req, res) => {
    try {
        if(req.session.user_id){
            let Manila = momenttz.tz(new Date(), "Asia/Manila");
            let servertime = Manila.format('L LTS')
            const catalog = new TCFCatalog({
                Catalog: req.body.CatalogEntry,
                addedby: req.session.user_id,
                ServerTime: servertime
            })
            await catalog.save()
            res.send(catalog)
        } else {
            req.session.user_id = null;
            res.redirect('/');
        }
    } catch (err){
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
    console.log(req.body)
})


router.delete('/deletecatalog', async (req, res) => {
    try {
        if(req.session.user_id){
            console.log(req.body.catalogtoDelete)
            await TCFCatalog.findOneAndDelete({Catalog: req.body.catalogtoDelete})
            res.send({
                deletedcatalog: req.body.catalogtoDelete
            })
        } else {
            req.session.user_id = null;
            res.redirect('/');
        }
    } catch (err){
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})


router.post('/addassignedby', async (req, res) => {
    try {
        if(req.session.user_id){
            let Manila = momenttz.tz(new Date(), "Asia/Manila");
            let servertime = Manila.format('L LTS')
            const assignedby = new TCFAssignedBy({
                Assigned: req.body.assignedbyEntry,
                addedby: req.session.user_id,
                ServerTime: servertime
            })
            await assignedby.save()
            res.send(assignedby)
        } else {
            req.session.user_id = null;
            res.redirect('/');
        }
    } catch (err){
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
    console.log(req.body)
})


router.delete('/deleteassignedby', async (req, res) => {
    try {
        if(req.session.user_id){
            console.log(req.body.assignedbytoDelete)
            await TCFAssignedBy.findOneAndDelete({Assigned: req.body.assignedbytoDelete})
            res.send({
                deletedAssigned: req.body.assignedbytoDelete
            })
        } else {
            req.session.user_id = null;
            res.redirect('/');
        }
    } catch (err){
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

module.exports = router;