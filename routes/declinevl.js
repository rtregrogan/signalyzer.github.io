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

let Manila = momenttz.tz(new Date(), "Asia/Manila");
let servertime = Manila.format('L LTS')

router.post('/', async (req, res) => {
    try {
        if(req.session.user_id){
            console.log(req.body)
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
                const allLeavesRequests = {
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'Leave Requests'
                }
                const gsapi = google.sheets({version: 'v4', auth: cl})
                let allLeavesRequestsData = await gsapi.spreadsheets.values.get(allLeavesRequests);
                // console.log(allLeavesRequestsData.data.values)

                let indexToUpdate
                for (i=0; i<allLeavesRequestsData.data.values.length; i++){
                    if(allLeavesRequestsData.data.values[i][0] == req.body.schedID){
                        indexToUpdate = allLeavesRequestsData.data.values.indexOf(allLeavesRequestsData.data.values[i])
                    }
                }

                let values = [
                    [
                        'Declined'
                    ]
                ]
                let resource = {
                    values
                }
                await gsapi.spreadsheets.values.update({
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: `Leave Requests!G${indexToUpdate + 1}`,
                    valueInputOption: 'RAW',
                    resource
                })

                updateComments(client)
            }

            async function updateComments(cl){
                const allLeavesRequests = {
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'Leave Requests'
                }
                const gsapi = google.sheets({version: 'v4', auth: cl})
                let allLeavesRequestsData = await gsapi.spreadsheets.values.get(allLeavesRequests);
                // console.log(allLeavesRequestsData.data.values)

                let indexToUpdate
                for (i=0; i<allLeavesRequestsData.data.values.length; i++){
                    if(allLeavesRequestsData.data.values[i][0] == req.body.schedID){
                        indexToUpdate = allLeavesRequestsData.data.values.indexOf(allLeavesRequestsData.data.values[i])
                    }
                }
                let values = [
                    [
                        req.body.declineComment
                    ]
                ]
                let resource = {
                    values
                }
                await gsapi.spreadsheets.values.update({
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: `Leave Requests!L${indexToUpdate + 1}`,
                    valueInputOption: 'RAW',
                    resource
                })

                // sending email
                let allrequestsPart = []
                for(i=0; i<allLeavesRequestsData.data.values.length; i++){
                    if(allLeavesRequestsData.data.values[i][10] == req.body.requestID){
                        allrequestsPart.push(allLeavesRequestsData.data.values[i])
                    }
                }
                
                let requestPending = false
                for(i=0; i<allrequestsPart.length; i++){
                    if(allrequestsPart[i][6] == 'Pending'){
                        requestPending = true
                    }
                }

                console.log(requestPending)
                if(!requestPending){
                    const user = await Roster.find({ userName: req.body.userID });
                    // console.log(user)
                    let datesRequested = []
                    for(i=0; i<allrequestsPart.length; i++){
                        if(allrequestsPart[i][6] == 'Approved'){
                            datesRequested.push(allrequestsPart[i][11])
                        }
                    }
                    const aAuth2Client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI)
                    aAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })

                    let emailBody = `Hi Dale,
                    
                    Please see leave application below:
        
                    Name: ${user[0].firstName} ${user[0].lastName}
                    Leave Type: ${req.body.leaveType}
                    Purpose: ${allrequestsPart[0][5]}
                    Dates: ${datesRequested}
                    Leave Options: ${req.body.vlOptions}
                    Number of Days: ${datesRequested.length}
                                        
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
                    to: 'rtregrogan@gmail.com, tianzonrupert@gmail.com',
                    // to: 'dale@xtendops.us, joeffrey@xtendops.us, ralph.villamor@xtendops.us',
                    subject: `Leave Application from ${user[0].firstName} ${user[0].lastName}`,
                    text: emailBody
                    }
                    const result = await transport.sendMail(mailOptions)
                    return result
                    }

                    sendEmail()
                    .then(result => console.log('Email Sent...', result))
                    .catch((error) => console.log(error))
                    
                }
                res.redirect('/adminschedule')
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