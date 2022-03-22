if (process.env.NODE_END !== "production"){
    require('dotenv').config();
}

const express = require("express");
const router = express.Router();
const momenttz = require('moment-timezone');
const { google } = require('googleapis')
const keys = require('../tcfentries.json')
const nodemailer = require('nodemailer');

const Roster = require('../models/roster');

router.post('/', async (req, res) => {
    try {
        if (req.session.user_id){
            const user = await Roster.findOne({userName: req.session.user_id});
            // console.log(user)
            let Manila = momenttz.tz(new Date(), "Asia/Manila");
            let servertime = Manila.format('L LTS')
            // console.log(req.body)
            let fromDate = new Date(req.body.from)
            let toDate = new Date(req.body.to)
            let dateInterval
            let datesApplied = []

            function getDifferenceInDays(date1, date2) {
                const diffInMs = Math.abs(date2 - date1);
                // console.log(diffInMs)
                dateInterval = diffInMs / (1000 * 60 * 60 * 24)
            }
            getDifferenceInDays(fromDate, toDate)
            // console.log(dateInterval)
            
            datesApplied.push(fromDate)
            for(i=0; i<dateInterval; i++){
                let nextdayMs = fromDate.getTime() + 86400000
                // console.log(nextdayMs)
                theNextdayfromStartDate = new Date(nextdayMs)
                datesApplied.push(theNextdayfromStartDate)
                fromDate = theNextdayfromStartDate
            }

            // console.log(datesApplied)
            // console.log(datesApplied.length)

            let values = []
            for(i=0; i<datesApplied.length; i++){
                let startdateConvert = momenttz.tz(new Date(datesApplied[i]), "Asia/Manila");
                let startdateConverted = startdateConvert.format('L LTS')
                // console.log(startdateConverted)
                values.push([
                    req.session.user_id,
                    startdateConverted,
                    req.body.leaveType,
                    req.body.vlOptionsFill,
                    req.body.leaveReason,
                    "Pending",
                    servertime
                ])
            }

            const resource = {
                values
            }

            // console.log(resource)
            // updating googlesheets:
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
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'Leave Requests'
                }

                const gsapi = google.sheets({version: 'v4', auth: cl})
                let data = await gsapi.spreadsheets.values.get(opt);
                // console.log(data.data.values.length)

                await gsapi.spreadsheets.values.update({
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: `Leave Requests!B${data.data.values.length + 1}`,
                    valueInputOption: 'RAW',
                    resource
                })

                getNumberOfDays(client)
            }
            let totalnumberofdays = 0
            async function getNumberOfDays(cl){
                const opt = {
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'Leave Requests'
                }

                const gsapi = google.sheets({version: 'v4', auth: cl})
                let data = await gsapi.spreadsheets.values.get(opt);
                // console.log(data.data.values.length)

                for(i=1;i<data.data.values.length;i++){
                    if(data.data.values[i][1] == req.session.user_id){
                        if(data.data.values[i][6] == 'Pending'){
                            if(data.data.values[i][8] == 'NO'){
                                totalnumberofdays +=1
                            }
                        }
                    }
                }
                // console.log(totalnumberofdays)

                // sending email to leads
                const aAuth2Client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI)
                aAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
                let emailBody = `Please see leave application below:
            
                Name: ${user.firstName} ${user.lastName}
                Leave Type: ${req.body.leaveType}
                Purpose: ${req.body.leaveReason}
                From: ${req.body.from}
                To: ${req.body.to}
                Leave Options: ${req.body.vlOptionsFill}
                Number of Days: ${totalnumberofdays}

                Please check your admin console
                
                THIS IS AN AUTOMATED EMAIL`

                async function sendEmail(){
                    const accessToken = await aAuth2Client.getAccessToken()
                    const transport = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            type: 'OAuth2',
                            user: 'rupert@xtendops.us',
                            clientId: process.env.GMAIL_CLIENT_ID,
                            clientSecret: process.env.GMAIL_CLIENT_SECRET,
                            refreshToken: process.env.GMAIL_REFRESH_TOKEN,
                            accessToken: accessToken
                        }
                    })

                    const mailOptions = {
                        from: 'Signalyzer Admin <rupert@xtendops.us>',
                        // to: 'rtregrogan@gmail.com, tianzonrupert@gmail.com',
                        to: 'joeffrey@xtendops.us, ralph.villamor@xtendops.us',
                        subject: `Leave Application from ${user.firstName} ${user.lastName}`,
                        text: emailBody
                    }
                    const result = await transport.sendMail(mailOptions)
                    return result
                }

                sendEmail()
                .then(result => console.log('Email Sent...', result))
                .catch((error) => console.log(error))

                if(user.isAdmin){
                    res.redirect('/adminschedule')
                }
                res.redirect('/schedule/agent')
            }
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