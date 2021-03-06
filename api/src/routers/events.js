const express = require('express')
const db = require('../db')
const log = require('../log')

const router = express.Router()

router.post('/', async (req, res) => {
    log.debug(req.body)

    if (req.body.type === 'url_verification') {
        res.send({ challenge: req.body.challenge })
        return
    }

    const { type } = req.body.event

    // remove app, all tokens
    // TODO: remove all relate google token
    if (type === 'tokens_revoked') {
        const teamRes = await db.SlackTeam.get({ team_id: req.body.team_id })

        log.debug(teamRes.data)

        if (teamRes.data.data.length > 0) {
            try {
                const usersRes = await db.SlackUser.get({
                    slack_team: teamRes.data.data[0]._id,
                })

                log.debug(usersRes.data)

                if (usersRes.data.data.length > 0) {
                    usersRes.data.data.forEach(user => {
                        if (user.google_tokens) {
                            db.GoogleToken.delete({
                                _id: user.google_tokens._id,
                            })
                        }

                        db.SlackUser.delete({ _id: user._id })
                    })
                }
                db.SlackTeam.delete({ team_id: req.body.team_id })

                log.info('app was be uninstall in', req.body.team_id)
            } catch (err) {
                log.error(err)
            }
        }
    }

    res.status(200).end()
})

module.exports = router
