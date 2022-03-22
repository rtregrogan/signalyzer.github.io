const express = require('express');
const router = express.Router();
const { google } = require('googleapis')
const keys = require('../tcfentries.json')

router.get('/', async (req, res) => {
    try {
        if (req.session.user_id){
            let calendarToSend = [];

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
                    range: 'Calendar'
                }
    
                const gsapi = google.sheets({version: 'v4', auth: cl})
                let data = await gsapi.spreadsheets.values.get(opt);
                let sliceEnd = data.data.values.length + 1
                let finalData = data.data.values.slice(1, sliceEnd)
                // console.log(finalData.length)
                for (i=0; i<finalData.length; i++){
                    let singleDate = {
                        Date: finalData[i][0],
                        Month: finalData[i][1],
                        Day: finalData[i][2],
                        Year: finalData[i][3],
                        WeekNumber: finalData[i][4],
                        WeekDayNumber: finalData[i][5],
                        MonthFilter: finalData[i][7]
                    }
                    calendarToSend.push(singleDate)
                }
                res.send(calendarToSend)
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