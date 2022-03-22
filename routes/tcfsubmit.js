const express = require('express');
const router = express.Router();
const momenttz = require('moment-timezone');
const { google } = require('googleapis');
const keys = require('../tcfentries.json')

const TCFEntries = require('../models/tvfentries');
const Agenttask = require('../models/agenttasks');

router.post('/', async (req, res)=>{
    try {
        if (req.session.user_id){
            const {tasktypeSelect, project, catalogtcf, Hrs, Min, Sec, status, assignedby, billtype} = req.body
            let Manila = momenttz.tz(new Date(), "Asia/Manila");
            let servertime = Manila.format('L LTS')

            // sectomin = parseFloat(Sec) / 60
            mintohr = parseFloat(Min) / 60
            finalhr = parseFloat(Hrs) + mintohr
            console.log(finalhr)

            const shiftEnries =  await Agenttask.find({taskName: 'Shift'}).sort({created_at: -1}).limit(1)
            const shiftdate = shiftEnries[0].ShiftDate
            console.log(shiftdate)
            
            // const tcfEntry = new TCFEntries ({
            //     ShiftDate: shiftdate,
            //     TaskType: tasktypeSelect,
            //     Project: project,
            //     Catalog: catalogtcf,
            //     Hrs: Hrs,
            //     Min: Min,
            //     Sec: Sec,
            //     TotalHrs: finalhr,
            //     Status: status,
            //     AssignedBy: assignedby,
            //     BillingType: billtype,
            //     addedby: req.session.user_id,
            //     ServerTime: servertime
            // })
            // await tcfEntry.save()
            
            let values = [
                [
                    shiftdate,
                    tasktypeSelect,
                    project,
                    catalogtcf,
                    Hrs,
                    Min,
                    Sec,
                    finalhr,
                    status,
                    assignedby,
                    billtype,
                    req.session.user_id,
                    servertime
                ]
            ]

            const resource = {
                values
            }

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
                // console.log(data.data.values.length)

                await gsapi.spreadsheets.values.update({
                    spreadsheetId: '1xDwe0HYZo43dDAQXfD-izZD_olpqdI-sX8aD7zWbrSc',
                    range: `Sheet1!A${data.data.values.length + 1}`,
                    valueInputOption: 'RAW',
                    resource
                })
            }

            res.redirect('/')



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