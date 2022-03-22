const express = require("express");
const app = express();
const path = require("path");
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const methodOverride = require('method-override');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');
const moment = require('moment');
const m = moment();
const momenttz = require('moment-timezone');
const bodyParser = require('body-parser');
const objectstocsv = require('objects-to-csv')
const fs = require('fs')

// const passport = require('passport');
// const localStrategy = require('passport-local');

// roster management routes
// const rosmanagement = require('./routes/roster');
// app.use('/rosmanagement', rosmanagement);

const sessionOptions = { 
    secret: 'notagoodsecret', 
    resave: false, 
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 120,
        maxAge: 1000 * 60 * 120
    }
}

// connecting to database
const dbUrl = process.env.DB_URL || 'mongodb+srv://admin:TriskelioN12@cluster0.o9j4k.mongodb.net/signals?retryWrites=true&w=majority';
mongoose.connect(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false})
    .then(() => {
        console.log('connection open!');
    })
    .catch(() => {
    console.log('error');
    })

const Task = require('./models/tasks');
const Roster = require('./models/roster');
const Agenttask = require('./models/agenttasks');
const TCFTaskType = require('./models/tcftasktype');
const TCFCatalog = require('./models/tcfcatalog');
const TCFAssignedBy = require('./models/tcfassignedby');
const apiAcces = require('./models/apiAccesscodes');
const passport = require("passport");
const { request } = require("http");


app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

app.use(session(sessionOptions));
app.use(flash());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    if(req.method==='OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH')
        return res.status(200).json({});
    }
    next();
})
// app.use(passport.initialize());
// app.use(passport.session);
// passport.use(new localStrategy(Roster.authenticate()));
// passport.serializeUser(Roster.serializeUser());
// passport.deserializeUser(Roster.deserializeUser());

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());

app.get('/', async (req, res) => {
    const user = await Roster.findOne({userName: req.session.user_id});
    if (user) {
        if (user.isActive) {
            if (user.isAdmin) {
                res.redirect('/adminhome');
            } else {
                res.redirect('/agenthome');
            }
        } else {
            res.render('home');
        }
    } else {
        res.render('home');
    }
});

//log in function
app.post('/login', async (req, res) => {
    const { userName, password } = req.body
    const user = await Roster.find({ userName: userName });
    actUser = user[0]
    const validpw = await bcrypt.compare(password, actUser.password)
    if(validpw){
        if (actUser.isSuperAdmin || actUser.isActive && actUser.Account == "Signals") {
            req.session.user_id = actUser.userName;
            if (actUser.isAdmin) {
                res.redirect('/adminhome')
            } else {
                res.redirect('/agenthome')
            }
        } else {
            res.render('home')
        }
    } else {
        res.render('home')
    }
});

app.get('/agenthome', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        const agentTasks = await Agenttask.find({userName: req.session.user_id}).sort({created_at: -1}).limit(500);
        const ongoingTasks = await Agenttask.find({userName: req.session.user_id, onGoing: true}).sort({created_at: -1});
        const endedTasks = await Agenttask.find({userName: req.session.user_id, onGoing: false}).sort({created_at: -1}).limit(500);
        if (user.isActive) {
            if (user.isAdmin) {
                res.redirect('/adminhome')
            } else {
                const tcftasktype = await TCFTaskType.find({}).sort({TaskType: 1})
                const tcfcatalog = await TCFCatalog.find({}).sort({Catalog: 1})
                const tcfassignedby = await TCFAssignedBy.find({}).sort({Assigned: 1})
                const results = endedTasks.slice(0, 50)
                const pages = endedTasks.length / 50
                // console.log(pages)
                let p = []
                for (i=1; i<pages; i++){
                    // console.log(i)
                    p.push([i])
                }
                // console.log(p)





                // getting TCF entries Here:
                const { google } = require('googleapis')
                const keys = require('./tcfentries.json')
                const aTask = await Agenttask.findOne({taskName: "Shift"}).sort({created_at: -1}).limit(1);
                // console.log(aTask)

                let tcfforShiftDate = []
                const client = new google.auth.JWT(
                    keys.client_email,
                    null,
                    keys.private_key,
                    ['https://www.googleapis.com/auth/spreadsheets']
                )

                client.authorize(function(err, tokens){
                    if(err){
                        console.log(err)
                    } else {
                        // console.log('connected to google sheets API!')
                        gsrun(client)
                    }
                })

                async function gsrun(cl){
                    const opt = {
                        spreadsheetId: '1xDwe0HYZo43dDAQXfD-izZD_olpqdI-sX8aD7zWbrSc',
                        range: 'Sheet1'
                    }
        
                    const gsapi = google.sheets({version: 'v4', auth: cl})
                    let data = await gsapi.spreadsheets.values.get(opt);
                    // console.log(data.data.values[1])
        
                    // let sliceStart = data.data.values.length - 500
                    let sliceEnd = data.data.values.length + 1
                    let finalData = data.data.values.slice(1, sliceEnd)
                    // console.log(finalData)
                    for(i=0;i<finalData.length;i++){
                        if (finalData[i][0] == aTask.ShiftDate && finalData[i][11] == req.session.user_id){
                            tcfforShiftDate.push(finalData[i])
                        }
                    }
                    // getEntries(tcfforShiftDate)
                    // console.log(tcfforShiftDate)
                    const npd = await Task.find({taskType: 'Non-Project Delivery'}).sort({taskName: 1});
                    const pd = await Task.find({taskType: 'Project Delivery'}).sort({taskName: 1});
                    let tcfnotEnough = req.flash('tcfnotEnough')
                    res.render('agenthome', { npd, pd, user, agentTasks, ongoingTasks, endedTasks, results, p, tcftasktype, tcfcatalog, tcfassignedby, tcfnotEnough, tcfforShiftDate})
                }

                // const npd = await Task.find({taskType: 'Non-Project Delivery'}).sort({taskName: 1});
                // const pd = await Task.find({taskType: 'Project Delivery'}).sort({taskName: 1});
                // let tcfnotEnough = req.flash('tcfnotEnough')
                // res.render('agenthome', { npd, pd, user, agentTasks, ongoingTasks, endedTasks, results, p, tcftasktype, tcfcatalog, tcfassignedby, tcfnotEnough})
            }
        } else {
            res.redirect('/');
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
});

// agent home pagination
app.post('/agenthomepaginate', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        const agentTasks = await Agenttask.find({userName: req.session.user_id}).sort({created_at: -1}).limit(500);
        const ongoingTasks = await Agenttask.find({userName: req.session.user_id, onGoing: true}).sort({created_at: -1});
        const endedTasks = await Agenttask.find({userName: req.session.user_id, onGoing: false}).sort({created_at: -1}).limit(500);
        if(user.isActive){
            const { page } = req.body
            const limit = 50
            const startIndex = (page-1) * limit
            const endIndex = page * limit
            const pages = endedTasks.length / limit
            let p = []
            for (i=1; i<pages; i++){
                p.push([i])
            }
            let results = endedTasks.slice(startIndex, endIndex)
            if (endIndex < endedTasks.length) {
                results.next = {
                    page: page + 1,
                    limit: limit
                }
            }
            if (startIndex > 0){
                results.prev = {
                    page: page - 1,
                    limit: limit
                }
            }
            const npd = await Task.find({taskType: 'Non-Project Delivery'}).sort({taskName: 1});
            const pd = await Task.find({taskType: 'Project Delivery'}).sort({taskName: 1});
            res.render('agenthome', { npd, pd, user, agentTasks, ongoingTasks, endedTasks, results, p})
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

// agent  password reset
app.get('/agentpwreset', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        res.render('agentpwreset', {user, msg: req.flash(), err: req.flash()});
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
});

app.put('/agentpwreset', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        const uname = user.userName;
        const pw = req.body.password;
        const cpw = req.body.confirmpw;
        const hash = await bcrypt.hash(pw, 12);
        if (pw===cpw) {
            const filter = {userName: uname}
            const update = {
                password: hash,
            }
            await Roster.findOneAndUpdate(filter, update);
            req.flash('success','Password Changed')
            res.render('agentpwreset', {user, msg: req.flash('success'), err: req.flash()});
        } else if (pw!==cpw) {
            console.log(false)
            req.flash('error','Confirm Password did not match')
            res.render('agentpwreset', {user, err: req.flash('error'), msg: req.flash()});
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

// agents adding tasks

app.post('/addagenttask', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        const tasktype = await Task.findOne({taskName: req.body.taskName});
        let random = Math.floor(Math.random()*99999999) + 100001
        const agentTasksid = await Agenttask.findOne({taskID: random});
        while (agentTasksid !== null) {
            random = Math.floor(Math.random()*99999999) + 100001
        }
        const ShiftEntry = await Agenttask.find({userName: req.session.user_id, taskName: "Shift"})
        let Manila = momenttz.tz(new Date(), "Asia/Manila");
        let startDate = Manila.format('L LTS')
        let shiftDate = ""
    
        if (req.body.taskName == "Shift") {
            shiftDate = Manila.format('L LTS').slice(0, 10)
        } else {
            shiftDate = ShiftEntry[ShiftEntry.length-1].startDate.slice(0, 10)
        }
    
        console.log(Manila.format('L LTS'))
        const fn = user.firstName + " " + user.lastName
        
        const AgentTask = new Agenttask({
            ShiftDate: shiftDate,
            taskID: random,
            userName: user.userName,
            fullName: fn,
            taskName: req.body.taskName,
            taskType: tasktype.taskType,
            startDate: startDate,
            onGoing: true
        })
        await AgentTask.save()
            .then(() => {
                res.redirect('/');
            })
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

// agents update tasks

app.put('/agenttaskput', async (req, res) => {
    try {
        const tid = req.body.taskID;
        const coms = req.body.comments;
        const user = await Roster.findOne({userName: req.session.user_id});
        // duration start
    
        const endtak = momenttz.tz(new Date(), "Asia/Manila");
        const endDate = endtak.format('L LTS')
        const aTask = await Agenttask.findOne({taskID: tid});
        const taskStart = new Date(aTask.startDate).getTime();
        const taskEnd = new Date(endDate).getTime();
        const distance = taskEnd - taskStart;
        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((distance % (1000 * 60)) / 1000);
        const durationTime = hours + 'h ' + minutes + 'm ' + seconds + 's'
    
        // duration end

        // reading tcf utilization hrs starts

        const { google } = require('googleapis')
        const keys = require('./tcfentries.json')
        let tcfforShiftDate = []


        if(req.session.user_id == "rtianzon2") {
            endtasknow()
        } else {
            if(aTask.taskName == "Shift"){
                const client = new google.auth.JWT(
                    keys.client_email,
                    null,
                    keys.private_key,
                    ['https://www.googleapis.com/auth/spreadsheets']
                )
    
                client.authorize(function(err, tokens){
                    if(err){
                        console.log(err)
                    } else {
                        // console.log('connected to google sheets API!')
                        gsrun(client)
                    }
                })
    
                async function gsrun(cl){
                    const opt = {
                        spreadsheetId: '1xDwe0HYZo43dDAQXfD-izZD_olpqdI-sX8aD7zWbrSc',
                        range: 'Sheet1'
                    }
        
                    const gsapi = google.sheets({version: 'v4', auth: cl})
                    let data = await gsapi.spreadsheets.values.get(opt);
                    // console.log(data.data.values[1])
        
                    // let sliceStart = data.data.values.length - 500
                    let sliceEnd = data.data.values.length + 1
                    let finalData = data.data.values.slice(1, sliceEnd)
                    for(i=0;i<finalData.length;i++){
                        if (finalData[i][0] == aTask.ShiftDate && finalData[i][11] == req.session.user_id){
                            tcfforShiftDate.push(finalData[i])
                        }
                    }
                    getEntries(tcfforShiftDate)
                    // console.log(tcfforShiftDate)
                }
            } else {
                endtasknow()
            }
        }

        async function getEntries(entries){
            let totalTCF = 0
            // console.log(entries)
            for(i=0;i<entries.length;i++){
                // console.log(parseFloat(entries[i][7]))
                totalTCF = totalTCF + parseFloat(entries[i][7])
            }
            // console.log(totalTCF)
            if(totalTCF<7.5){
                let remainingUtil = 7.5 - totalTCF
                let hrsDec = remainingUtil % 1
                let minRemain = 60 * hrsDec
                console.log(remainingUtil)
                console.log(hrsDec)
                console.log(minRemain.toFixed(0))
                req.flash('tcfnotEnough', `Sorry your TCF entries is not enough. You need ${remainingUtil.toFixed(2)} hrs more or ${remainingUtil-hrsDec}:${minRemain.toFixed(0)}:00.`)
                // console.log(`remaining UTIL ${remainingUtil * 60}`)
                // console.log(req.flash('tcfnotEnough'))
            } else {
                endtasknow()
            }
            res.redirect('/')
        }

        async function endtasknow(){
            const filter = { taskID: tid };
            const update = { 
                onGoing: false,
                endDate,
                durationTime,
                durationHr: hours,
                durationMn: minutes,
                durationSc: seconds,
                comments: coms,
                UpdatedBy: user.userName
            };
            await Agenttask.findOneAndUpdate(filter, update)
            res.redirect('/')
        }

        // reading tcf utilization hrs ends
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

app.post('/logout', (req, res) => {
    req.session.user_id = null;
    res.redirect('/');
})

// admin routes

app.get('/adminhome', async (req, res) => {
 try {
    const user = await Roster.findOne({userName: req.session.user_id});
    const agentTasks = await Agenttask.find({userName: req.session.user_id}).sort({created_at: -1}).limit(500);
    const ongoingTasks = await Agenttask.find({userName: req.session.user_id, onGoing: true}).sort({created_at: -1});
    const endedTasks = await Agenttask.find({userName: req.session.user_id, onGoing: false}).sort({created_at: -1}).limit(500);
    if (user.isActive && user.isAdmin) {
        const npd = await Task.find({taskType: 'Non-Project Delivery'}).sort({taskName: 1});
        const pd = await Task.find({taskType: 'Project Delivery'}).sort({taskName: 1});
        const tcftasktype = await TCFTaskType.find({}).sort({TaskType: 1})
        const tcfcatalog = await TCFCatalog.find({}).sort({Catalog: 1})
        const tcfassignedby = await TCFAssignedBy.find({}).sort({Assigned: 1})
        const results = endedTasks.slice(0, 50)
        const pages = endedTasks.length / 50
        let p = []
        for (i=1; i<pages; i++) {
            p.push([i])
        }
        let tcfnotEnough = req.flash('tcfnotEnough')

        // getting pending request

        const { google } = require('googleapis')
        const keys = require('./tcfentries.json')
        const client = new google.auth.JWT(
            keys.client_email,
            null,
            keys.private_key,
            ['https://www.googleapis.com/auth/spreadsheets']
        )
        client.authorize(function(err, tokens){
            if(err){
                console.log(err)
            } else {
                // console.log('connected to google sheets API!')
                gsrun(client)
            }
        })
        async function gsrun(cl){
            const gsapi = google.sheets({version: 'v4', auth: cl})

            //getting leave credits:
            let pendingRequestsDatatoSend = []
            const pendingRequests = {
                spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                range: 'Leave Requests'
            }
            let pendingRequestsData = await gsapi.spreadsheets.values.get(pendingRequests);
            // console.log(pendingRequestsData.data.values)

            for(i=1;i<pendingRequestsData.data.values.length;i++){
                if(pendingRequestsData.data.values[i][6] == 'Pending'){
                    if(pendingRequestsData.data.values[i][8] == 'NO'){
                        pendingRequestsDatatoSend.push(pendingRequestsData.data.values[i])
                    }
                }
            }

            // console.log(pendingRequestsDatatoSend)
            res.render('adminhome', { 
                npd, 
                pd, 
                user, 
                agentTasks, 
                ongoingTasks, 
                endedTasks, 
                results, 
                p, 
                tcftasktype, 
                tcfcatalog, 
                tcfassignedby, 
                tcfnotEnough,
                pendingRequestsDatatoSend
            })
        }
    } else {
        res.redirect('/')
    }
 } catch (err) {
    console.log(err)
    req.session.user_id = null;
    res.redirect('/');
 }
});

// admin home paginate
app.post('/adminhomepaginate', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        const agentTasks = await Agenttask.find({userName: req.session.user_id}).sort({created_at: -1}).limit(500);
        const ongoingTasks = await Agenttask.find({userName: req.session.user_id, onGoing: true}).sort({created_at: -1});
        const endedTasks = await Agenttask.find({userName: req.session.user_id, onGoing: false}).sort({created_at: -1}).limit(500); 
        if (user.isActive && user.isAdmin) {
            const npd = await Task.find({taskType: 'Non-Project Delivery'}).sort({taskName: 1});
            const pd = await Task.find({taskType: 'Project Delivery'}).sort({taskName: 1});
            const { page } = req.body
            const limit = 50
            const startIndex = (page-1) * limit
            const endIndex = page * limit
            const pages = endedTasks.length / limit
            let p = []
            for (i=1; i<pages; i++) {
                p.push([i])
            }
            let results = endedTasks.slice(startIndex, endIndex)
            if (endIndex < endedTasks.length) {
                results.next = {
                    page: page + 1,
                    limit: limit
                }
            }
            if (startIndex > 0){
                results.prev = {
                    page: page - 1,
                    limit: limit
                }
            }
            res.render('adminhome', { npd, pd, user, agentTasks, ongoingTasks, endedTasks, results, p})
    
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

// admin password reset

app.get('/adminpwreset', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        if (user.isActive && user.isAdmin) {
            const user = await Roster.findOne({userName: req.session.user_id});
            res.render('adminpwreset', {user, msg: req.flash(), err: req.flash()});
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
});

app.put('/adminpwreset', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        if (user.isActive && user.isAdmin) {
            const uname = user.userName;
            const pw = req.body.password;
            const cpw = req.body.confirmpw;
            const hash = await bcrypt.hash(pw, 12);
            if (pw===cpw) {
                const filter = {userName: uname}
                const update = {
                    password: hash,
            }
                await Roster.findOneAndUpdate(filter, update);
                req.flash('success','Password Changed')
                res.render('adminpwreset', {user, msg: req.flash('success'), err: req.flash()});
            } else if (pw!==cpw) {
                console.log(false)
                req.flash('error','Confirm Password did not match')
                res.render('adminpwreset', {user, err: req.flash('error'), msg: req.flash()});
            }
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

// admin monitor

app.get('/adminmonitor', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        if(user.isActive && user.isAdmin) {
            const tsk = await Task.find({}).sort({taskName: 1});
            const ongoingTasks = await Agenttask.find({onGoing: true}).sort({userName: 1});
            const endedTasks = await Agenttask.find({onGoing: false}).sort({created_at: -1}).limit(500);
            const agents = await Roster.find({Account: 'Signals'}).sort({firstName: 1});
            const results = endedTasks.slice(0, 50)
            const pages = endedTasks.length / 50
            let p = []
            for (i=1; i<pages; i++){
                p.push([i])
            }
            let alluserName = []
            for (i=0; i<agents.length; i++){
                alluserName.push({userName: `${agents[i].userName}`, fullName: `${agents[i].firstName} ${agents[i].lastName}`})
            }
            res.render('adminmonitor', { 
                user, 
                endedTasks, 
                agents, 
                tsk, 
                ongoingTasks, 
                endedTasks, 
                results, 
                p,
                alluserName: alluserName
            });
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
});

// admin monitor paginatoin
app.post('/paginate', async(req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        if(user.isActive && user.isAdmin) {
            const tsk = await Task.find({}).sort({taskName: 1});
            const ongoingTasks = await Agenttask.find({onGoing: true}).sort({userName: 1});
            const endedTasks = await Agenttask.find({onGoing: false}).sort({created_at: -1}).limit(500);
            const agents = await Roster.find({});
            let alluserName = []
            for (i=0; i<user.length; i++){
                alluserName.push({userName: `${user[i].userName}`, fullName: `${user[i].firstName} ${user[i].lastName}`})
            }
            const { page } = req.body
            const limit = 50
            const startIndex = (page-1) * limit
            const endIndex = page * limit
            const pages = endedTasks.length / limit
            let p = []
            for (i=1; i<pages; i++){
                p.push([i])
            }
            let results = endedTasks.slice(startIndex, endIndex)
            if (endIndex < endedTasks.length) {
                results.next = {
                    page: page + 1,
                    limit: limit
                }
            }
            if (startIndex > 0){
                results.prev = {
                    page: page - 1,
                    limit: limit
                }
            }
            res.render('adminmonitor', { user, endedTasks, agents, tsk, ongoingTasks, endedTasks, results, p, alluserName: alluserName});
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

// task override

app.put('/adminmonitor', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        if(user.isActive && user.isAdmin) {
            const tid = req.body.taskID;
            const coms = req.body.comments;
            const newstartDate = req.body.startDate;
            const newendDate = req.body.endDate;
            const tasktype = await Task.findOne({taskName: req.body.taskName});
            // duration start
    
            const taskStart = new Date(newstartDate).getTime();
            const taskEnd = new Date(newendDate).getTime();
            const distance = taskEnd - taskStart;
            var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            var seconds = Math.floor((distance % (1000 * 60)) / 1000);
            const durationTime = hours + 'h ' + minutes + 'm ' + seconds + 's'
    
            // duration end
            const filter = { taskID: tid };
    
            const update = { 
                taskName: req.body.taskName,
                taskType: tasktype.taskType,
                startDate: newstartDate,
                endDate: newendDate,
                durationTime: durationTime,
                durationHr: hours,
                durationMn: minutes,
                durationSc: seconds,
                comments: coms,
                UpdatedBy: user.userName
            };
            await Agenttask.findOneAndUpdate(filter, update);
            res.redirect('/adminmonitor')
            console.log('adminmonitor put route')
            console.log(req.body)
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
});

//admin monitor that renders a frame

// app.get('/adminmonitor2', async (req, res) => {
//     const user = await Roster.findOne({userName: req.session.user_id});
//     if(user.isActive && user.isAdmin) {
//         const ongoingTasks = await Agenttask.find({onGoing: true}).sort({fullName: 1, created_at: -1});
//         res.render('adminmonitor2', { user, ongoingTasks});
//     } else {
//         res.redirect('/')
//     }
// });

// roster management
app.get('/rostermanagement', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        const roster = await Roster.find({}).sort({created_at: -1})
        if (user.isActive && user.isAdmin) {
            res.render('rostermanagement', { roster, user })
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

// adding user
app.post('/rostermanagement', async (req, res) => {
    try {
        const roster = await Roster.find({})
        req.body.sigID = roster[roster.length - 1].sigID + 1;
        const existUserName = await Roster.find({userName: req.body.userName});
        if (existUserName[0] == null) {
            const { sigID, firstName, lastName, userName, Title, password, isActive, isAdmin } = req.body;
            const hash = await bcrypt.hash(password, 12);
            const user = new Roster({
                sigID,
                firstName,
                lastName,
                Department: "Operations",
                Account: "Signals",
                Title,
                userName,
                password: hash,
                isActive,
                isAdmin
            })
            await user.save()
                .then(() => {
                res.redirect('/rostermanagement')
            })
        } else {
            res.send(`Username ${req.body.userName} is already taken!`)
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

app.put('/rostermanagement', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        const uname = req.body.userName
        const fname = req.body.firstName
        const lname = req.body.lastName
        const pw = req.body.password
        const isActive = req.body.isActive
        const isAdmin = req.body.isAdmin
        const hash = await bcrypt.hash(pw, 12);
        const filter = {userName: uname}
        const usertochange = await Roster.findOne({userName: uname});
        console.log(usertochange)
        const update = {
            firstName: fname,
            lastName: lname,
            password: hash,
            isActive: isActive,
            isAdmin: isAdmin,
            UpdatedBy: `${user.userName}`
        }
        await Roster.findOneAndUpdate(filter, update)
            .then(()=>{
                // console.log(filter)
                console.log(update)
                res.redirect('/rostermanagement')
            })
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

//edit user

// app.get('/edituser', (req, res) => {
//     res.render('rmedituser');
// })

// Adding Task

app.get('/managetask', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        const task = await Task.find({}).sort({created_at: -1})
        if (user.isActive && user.isAdmin) {
            req.body.taskID = task[0].taskID + 1;
            res.render('managetask', { task, user });
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

app.post('/managetask', async (req, res) => {
    try {
        const task = await Task.find({}).sort({created_at: -1})
        req.body.taskID = task[0].taskID + 1;
        const fi = req.body.taskName.replace(/\s/g, '');
        req.body.taskU = fi + req.body.taskID;
        const { taskID, taskU, taskName, taskType, details } = req.body;
        const newTask = new Task({
            taskID,
            taskU,
            taskName,
            taskType,
            details
        })
        await newTask.save()
        res.redirect('managetask');
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

// deleting task

app.get('/managetask/:id', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        const task = await Task.findById(req.params.id)
        if (user.isActive && user.isAdmin) {
            res.render('taskshow', { task });
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})

app.delete('/managetask/:id', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        const { id } = req.params;
        const tasktoDelete = await Task.findOne({_id: id})
        await Task.findByIdAndDelete(id);
        console.log(tasktoDelete);
        console.log(user);
        res.redirect('/managetask');
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
});

//Reporting.Stats

app.get('/reports', async (req, res) => {
    try {
        const user = await Roster.findOne({userName: req.session.user_id});
        if (user.isActive && user.isAdmin) {
            res.render('adminreports', { user })
        } else {
            res.redirect('/')
        }
    } catch (err) {
        console.log(err)
        req.session.user_id = null;
        res.redirect('/');
    }
})


//API

app.get('/roster/api', async (req, res) => {
    const user = await Roster.find({}).sort({firstName: 1});
    res.send(user)
})

app.get('/signalyzer/api', async (req, res) => {
    const data = await Agenttask.find({}).sort({created_at: -1}).limit(500);
    // console.log(data.length)
    res.send(data)
})

app.get('/getservertime/api', async (req, res) => {
    let Manila = momenttz.tz(new Date(), "Asia/Manila");
    let servertime = Manila.format('L LTS')
    // let servertime2 = new Date(servertime).getTime()
    // console.log(servertime2)
    // console.log(new Date(servertime).getTime())
    res.send({servertime: servertime})
})


app.get('/downloadcsv', async (req, res) => {
    const user = await Roster.find({}).sort({firstName: 1});
    // console.log(user)
    let alluserName = []
    for (i=0; i<user.length; i++){
        alluserName.push({userName: `${user[i].userName}`, fullName: `${user[i].firstName} ${user[i].lastName}`})
    }
    // console.log(alluserName)
    res.render('downloadcsv', {alluserName: alluserName})
})

app.post('/getallTagging', async (req, res) => {
    console.log(req.body)
    // const user = await Roster.find({userName: req.body.userName}).sort({firstName: 1});
    const data = await Agenttask.find({userName: req.body.userName}).sort({created_at: -1});
    // console.log(data)
    let csvdata = []
    for(i=0; i<data.length; i++){
        csvdata.push({
            _id: data[i]._id,
            ShiftDate: data[i].ShiftDate,
            taskID: data[i].taskID,
            userName: data[i].userName,
            fullName: data[i].fullName,
            tagging: data[i].taskName,
            taskType: data[i].taskType,
            startDate: data[i].startDate,
            onGoing: data[i].onGoing,
            comments: data[i].comments,
            durationHr: data[i].durationHr,
            durationMn: data[i].durationMn,
            durationSc: data[i].durationSc,
            durationTotal: data[i].durationTime,
            endDate: data[i].endDate,
            UpdatedBy: data[i].UpdatedBy
        })
    }
    const csv = new objectstocsv(csvdata)
    // console.log(csv)
    await csv.toDisk(`./${req.body.userName}.csv`)
    return res.download(`./${req.body.userName}.csv`, () => {
        fs.unlinkSync(`./${req.body.userName}.csv`)
    })
})


const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`port is at ${port}`);
});


// tcf entry to form by admin starts here:

const alltcfentry = require('./routes/addtcfoptions');
app.use('/alltcfentry', alltcfentry)

const tcfsubmit = require('./routes/tcfsubmit');
app.use('/tcfsubmit', tcfsubmit)

const schedule = require('./routes/schedule');
app.use('/schedule', schedule)

const adminschedule = require('./routes/adminschedule');
app.use('/adminschedule', adminschedule)

const calendar = require('./routes/calendar');
app.use('/calendar', calendar)

const leavecreditdebit = require('./routes/leavecreditdebit');
app.use('/leavecreditdebit', leavecreditdebit)

const leaveapplication = require('./routes/leaveapplication');
app.use('/leaveapplication', leaveapplication)

const approvevl = require('./routes/approvevl');
app.use('/approvevl', approvevl)

const declinevl = require('./routes/declinevl');
app.use('/declinevl', declinevl)

const teamScheduleApi = require('./routes/teamScheduleApi');
app.use('/teamScheduleApi', teamScheduleApi)



app.get('/globeapi', (req, res) => {
    console.log(`Access Token is: ${req.query.access_token} | Subscriber number: ${req.query.subscriber_number}`)
    res.send(`API get Route | req.body: ${req.body} | req.query: ${req.query}`)
})

app.post('/globeapi', (req, res) => {
    console.log(req)
})

app.put('/globeapi', (req, res) => {
    console.log(req.body)
    res.send('API put route')
})

app.delete('/globeapi', (req, res) => {
    console.log(req.body)
    res.send('API delete route')
})

app.patch('/globeapi', (req, res) => {
    console.log(req.body)
    res.send('API patch route')
})