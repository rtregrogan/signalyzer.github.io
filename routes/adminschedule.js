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

router.get('/', async (req, res) => {
    try {
        if (req.session.user_id){
            const user = await Roster.find({ userName: req.session.user_id });
            let Manila = momenttz.tz(new Date(), "Asia/Manila");
            let servertime = Manila.format('L LTS')
            let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
            let currentMonth = `${months[new Date(Manila).getMonth()]} ${new Date(Manila).getFullYear()}`
            // console.log(`current month: ${currentMonth}`)
            // console.log(`year: ${new Date(Manila).getFullYear()}`)
            // console.log(`month: ${new Date(Manila).getMonth()}`)

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
                let monthFilterToSend
                const monthsToFilter = {
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'MonthFilter'
                }
                const gsapi = google.sheets({version: 'v4', auth: cl})
                let monthsToFilterData = await gsapi.spreadsheets.values.get(monthsToFilter);
                let monthsToFilterSliceEnd = monthsToFilterData.data.values.length + 1
                let monthsToFilterFinalData = monthsToFilterData.data.values.slice(1, monthsToFilterSliceEnd)
                let monthsToFilterFinalDataToSend = []
                // console.log(monthsToFilterFinalData)
                for(i=0; i<monthsToFilterFinalData.length; i++){
                    if (monthsToFilterFinalData[i][0] == currentMonth){
                        monthFilterToSend = monthsToFilterFinalData[i][0]
                    }
                    monthsToFilterFinalDataToSend.push(monthsToFilterFinalData[i][0])
                }
                // console.log(monthsToFilterFinalDataToSend)
                let monthIndex = monthsToFilterFinalDataToSend.indexOf(monthFilterToSend)
                if(monthIndex > -1){
                    monthsToFilterFinalDataToSend.splice(monthIndex, 1)
                }

                //getting leave credits:
                let leaveCreditstoSend = []
                const leaveCredits = {
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'Leave Credit/Debit'
                }
                let leaveCreditsData = await gsapi.spreadsheets.values.get(leaveCredits);
                // console.log(leaveCreditsData.data.values)

                for (i=0; i<leaveCreditsData.data.values.length; i++){
                    if(leaveCreditsData.data.values[i][4] == req.session.user_id){
                        leaveCreditstoSend.push({
                            date: leaveCreditsData.data.values[i][3],
                            type: leaveCreditsData.data.values[i][1],
                            days: leaveCreditsData.data.values[i][2],
                            hrs: leaveCreditsData.data.values[i][5]
                        })
                    }
                }
                // console.log(leaveCreditstoSend)

                //getting leave credits total:
                let leaveCreditsTotalToSend = []
                const leaveCreditsTotal = {
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'Leave Credit/Debit Pivot'
                }
                let leaveCreditsTotalData = await gsapi.spreadsheets.values.get(leaveCreditsTotal);
                // console.log(leaveCreditsTotalData.data.values)
                for(i=0; i<leaveCreditsTotalData.data.values.length; i++){
                    if(leaveCreditsTotalData.data.values[i][0] == req.session.user_id){
                        leaveCreditsTotalToSend.push({
                            hrs: leaveCreditsTotalData.data.values[i][1],
                            days: leaveCreditsTotalData.data.values[i][2]
                        })
                    }
                }
                // console.log(leaveCreditsTotalToSend)

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

                let teamScheduleForCurrentMonth = []
                const allTeamLeaves = {
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'Raw'
                }
                let allTeamLeavesData = await gsapi.spreadsheets.values.get(allTeamLeaves)
                let daysOfCurrentMonth = []
                // let startIndex = allTeamLeavesData.data.values.length - 50
                // let endIndex = allTeamLeavesData.data.values.length + 1
                // console.log(allTeamLeavesData.data.values)
                let currentMonthNum = new Date(Manila).getMonth()
                for(i=0; i<allTeamLeavesData.data.values.length; i++){
                    if(new Date(allTeamLeavesData.data.values[i][4]).getMonth() == currentMonthNum){
                        teamScheduleForCurrentMonth.push(allTeamLeavesData.data.values[i]) 
                    }
                }

                // console.log(teamScheduleForCurrentMonth)
                for(i=0; i<teamScheduleForCurrentMonth.length; i++){
                    // console.log(teamScheduleForCurrentMonth[i][2])
                    if(!daysOfCurrentMonth.includes(teamScheduleForCurrentMonth[i][2])){
                        daysOfCurrentMonth.push(teamScheduleForCurrentMonth[i][2])
                    }
                    // console.log(daysOfCurrentMonth.includes(teamScheduleForCurrentMonth[i][2]))
                }
                // console.log(daysOfCurrentMonth)

                let teamScheduleToSend = []
                for(i=0; i<daysOfCurrentMonth.length; i++){
                    teamScheduleToSend.push([
                        daysOfCurrentMonth[i]
                    ])
                    for(u=0; u<teamScheduleForCurrentMonth.length; u++){
                        if(daysOfCurrentMonth[i] == teamScheduleForCurrentMonth[u][2]){
                            if(teamScheduleForCurrentMonth[u][7] == 'Signals'){
                                teamScheduleToSend[i].push([
                                    teamScheduleForCurrentMonth[u]
                                ])
                            }
                        }
                        // console.log(teamScheduleForCurrentMonth[u])
                    }
                }

                // console.log(teamScheduleToSend)

                res.render('adminschedule', {
                    monthsToFilterFinalDataToSend, 
                    monthFilterToSend, 
                    leaveCreditstoSend, 
                    leaveCreditsTotalToSend,
                    pendingRequestsDatatoSend,
                    user: user[0],
                    teamScheduleToSend
                } )
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