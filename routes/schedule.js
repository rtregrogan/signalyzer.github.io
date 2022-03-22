const express = require("express");
const router = express.Router();
const momenttz = require('moment-timezone');
const { google } = require('googleapis')
const keys = require('../tcfentries.json')

const Roster = require('../models/roster');

router.get('/agent', async (req, res) =>{
    try {
        if (req.session.user_id){
            const user = await Roster.find({ userName: req.session.user_id });
            // console.log(user)
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

                let pendingRequest = []
                const pendingRequestALL = {
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'Leave Requests'
                }
                let pendingRequestALLData = await gsapi.spreadsheets.values.get(pendingRequestALL)
                for(i=0; i<pendingRequestALLData.data.values.length; i++){
                    if(pendingRequestALLData.data.values[i][1] == req.session.user_id){
                        pendingRequest.push(pendingRequestALLData.data.values[i])
                    }
                }

                // getting all leave

                let teamLeavesForCurrentMonth = []
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
                        if(allTeamLeavesData.data.values[i][3] == 'LEAVE'){
                            teamLeavesForCurrentMonth.push(allTeamLeavesData.data.values[i])
                        }
                    }
                }

                // console.log(teamLeavesForCurrentMonth)
                for(i=0; i<teamLeavesForCurrentMonth.length; i++){
                    // console.log(teamLeavesForCurrentMonth[i][2])
                    if(!daysOfCurrentMonth.includes(teamLeavesForCurrentMonth[i][2])){
                        daysOfCurrentMonth.push(teamLeavesForCurrentMonth[i][2])
                    }
                    // console.log(daysOfCurrentMonth.includes(teamLeavesForCurrentMonth[i][2]))
                }

                let teamLeavesToSend = []
                for(i=0; i<daysOfCurrentMonth.length; i++){
                    teamLeavesToSend.push([
                        daysOfCurrentMonth[i]
                    ])
                    for(u=0; u<teamLeavesForCurrentMonth.length; u++){
                        if(daysOfCurrentMonth[i] == teamLeavesForCurrentMonth[u][2]){
                            teamLeavesToSend[i].push([
                                teamLeavesForCurrentMonth[u]
                            ])
                        }
                        // console.log(teamLeavesForCurrentMonth[u])
                    }
                }
                // console.log(daysOfCurrentMonth)
                // console.log(teamLeavesToSend)

                // console.log(pendingRequest)

                res.render('agentschedule', {
                    monthsToFilterFinalDataToSend, 
                    monthFilterToSend, 
                    leaveCreditstoSend, 
                    leaveCreditsTotalToSend,
                    pendingRequest,
                    user: user[0],
                    teamLeavesToSend
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


router.get('/agentschedule', async (req, res) => {
    try {
        if (req.session.user_id){
            let loneAgentSched = []
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
                const scheduleAll = {
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'Raw'
                }
                const gsapi = google.sheets({version: 'v4', auth: cl})
                let schedAllAgents = await gsapi.spreadsheets.values.get(scheduleAll);
                // console.log(schedAllAgents.data.values)
                for(i=0; i<schedAllAgents.data.values.length; i++){
                    if(schedAllAgents.data.values[i][6] == req.session.user_id){
                        loneAgentSched.push({
                            agentDateID: schedAllAgents.data.values[i][0].replace(req.session.user_id, ""),
                            schedule: schedAllAgents.data.values[i][9]
                        })
                    }
                }
                // console.log(loneAgentSched)
                res.send(loneAgentSched)
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