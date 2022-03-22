if (process.env.NODE_END !== "production"){
    require('dotenv').config();
}

const express = require("express");
const router = express.Router();
const momenttz = require('moment-timezone');
const { google } = require('googleapis')
const keys = require('../tcfentries.json')

router.get('/', async (req, res) =>{
    try {
        if(req.session.user_id){

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
                const teamSched = {
                    spreadsheetId: '1pLWgmhYvLk3XJWESIkncUjHkTYkyFgRxAF-OHAvcB_8',
                    range: 'Raw'
                }
                const gsapi = google.sheets({version: 'v4', auth: cl})
                let teamSchedData = await gsapi.spreadsheets.values.get(teamSched);
                // console.log(teamSchedData.data.values)
                let allSchedSignals = []
                for(i=0; i<teamSchedData.data.values.length; i++){
                    if(teamSchedData.data.values[i][7] == 'Signals'){
                        allSchedSignals.push(teamSchedData.data.values[i])
                    }
                }
                // console.log(allSchedSignals)
                res.send(allSchedSignals)
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