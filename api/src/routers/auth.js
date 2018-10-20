const express = require('express')
const SlackAuth = require('../auth/slack')
const GoogleAuth = require('../auth/google')
const db = require('../db')
const log = require('../log')
const util = require('../util')

const router = express.Router()

router.get('/google/redirected', (req, res) => {
    if (req.query && req.query.code) {
        GoogleAuth.getToken(req.query.code).then(tokens => {
            db.GoogleToken.save(tokens.tokens)
                .then(result => {
                    // TODO: send message to slack
                    res.send(result.data)
                })
                .catch(err => {
                    log.debug(err)
                    // TODO: use api to send message to slack
                    res.send('not found')
                })
        })
    } else {
        // TODO: use api to send message to slack
        res.send('not found')
    }
})

router.get('/slack/url', (req, res) => {
    res.redirect(SlackAuth.getURL())
})

router.get('/google/url', (req, res) => {
    res.redirect(GoogleAuth.getURL())
})

router.get('/slack/redirected', async (req, res) => {
    const { query } = req

    if (!query.code) {
        res.send('code is invalid')
    }

    try {
        const tokens = await SlackAuth.getToken(query.code)

        if (tokens && tokens.data) {
            const team = await db.SlackTeam.get({
                team_id: tokens.data.team_id,
            })

            // encode access token
            tokens.data.access_token = util.Encode(tokens.data.access_token)
            tokens.data.bot.bot_access_token = util.Encode(
                tokens.data.bot.bot_access_token,
            )

            if (team.data && team.data.data.length > 0) {
                await db.SlackTeam.update({
                    query: `{"team_id": "${tokens.data.team_id}"}`,
                    value: JSON.stringify(tokens.data),
                })

                res.redirect('https://slack.com/app_redirect?app=ADHDD3T9P')
            } else {
                await db.SlackTeam.save(tokens.data)
                res.redirect('https://slack.com/app_redirect?app=ADHDD3T9P')
            }
        }
    } catch (err) {
        if (err.response) {
            log.debug(err.response.data)
            log.debug(err.response.status)
            log.debug(err.response.headers)
        } else if (err.request) {
            log.debug(err.request)
        } else {
            log.debug('unknown error')
        }

        res.status(400).send('Bad request')
    }
})

module.exports = router
