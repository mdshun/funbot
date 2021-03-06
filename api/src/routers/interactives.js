const express = require('express')
const axios = require('axios')
const log = require('../log')
const db = require('../db')
const Slack = require('../bot')
const util = require('../util')
const worker = require('../worker')

const router = express.Router()

router.post('/', async (req, res) => {
    res.status(200).end()

    log.debug(req.body)

    const payload = JSON.parse(req.body.payload)

    if (payload.actions && payload.actions[0] && payload.actions[0].name === 'cancel') {
        axios.post(payload.response_url, {
            response_type: 'ephemeral',
            replace_original: true,
            delete_original: true,
            text: '',
        })
    } else if (payload.callback_id === 'settings') {
        switch (payload.actions[0].name) {
            case 'list':
                try {
                    const userRes = await db.SlackUser.get({
                        user_id: payload.user.id,
                    })

                    log.debug(userRes.data)

                    const text =
                        !userRes.data.data[0] || !userRes.data.data[0].sheets || userRes.data.data[0].sheets.length === 0
                            ? 'You not have any sheet.'
                            : JSON.stringify(userRes.data.data[0].sheets, null, 4)
                    axios.post(payload.response_url, util.TextWithSettings(text))
                } catch (err) {
                    axios.post(payload.response_url, util.TextWithSettings('has error, please try again!!'))
                    log.error(err)
                }
                break
            case 'remove':
                try {
                    const userRes = await db.SlackUser.get({
                        user_id: payload.user.id,
                    })

                    log.debug(userRes.data)

                    const api = await Slack.BotAPI(payload.team.id)

                    const listsheets = userRes.data.data[0].sheets.map(sheet => {
                        return {
                            label: sheet,
                            value: sheet,
                        }
                    })

                    log.debug('remove list sheet', listsheets)

                    if (!listsheets || listsheets.length === 0) {
                        axios.post(payload.response_url, util.TextWithSettings('You not have any sheet'))
                        return
                    }

                    const dialog = {
                        trigger_id: payload.trigger_id,
                        dialog: {
                            callback_id: 'remove-sheet-id',
                            title: 'Remove sheet',
                            submit_label: 'Remove',
                            notify_on_cancel: false,
                            elements: [
                                {
                                    label: 'Sheets ID',
                                    type: 'select',
                                    name: 'sheet-id',
                                    options: listsheets,
                                },
                            ],
                        },
                    }

                    api.dialog.open(dialog).catch(err => {
                        axios.post(payload.response_url, util.TextWithSettings('has error, please try again!!'))
                        log.error(err)
                    })
                } catch (err) {
                    axios.post(payload.response_url, util.TextWithSettings('has error, please try again!!'))
                    log.error(err)
                }

                break
            case 'add':
                try {
                    const api = await Slack.BotAPI(payload.team.id)

                    const dialog = {
                        trigger_id: payload.trigger_id,
                        dialog: {
                            callback_id: 'add-sheet-id',
                            title: 'Add sheet',
                            submit_label: 'Add',
                            notify_on_cancel: true,
                            elements: [
                                {
                                    type: 'text',
                                    label: 'Sheet ID',
                                    name: 'sheet-id',
                                },
                            ],
                        },
                    }

                    api.dialog.open(dialog).catch(err => {
                        axios.post(payload.response_url, util.TextWithSettings('has error, please try again!!'))
                        log.error(err)
                    })
                } catch (err) {
                    axios.post(payload.response_url, util.TextWithSettings('has error, please try again!!'))
                    log.error(err)
                }
                break
            default:
                axios.post(payload.response_url, util.TextWithSettings('has error, please try again!!'))
                break
        }
    } else if (payload.callback_id === 'add-sheet-id') {
        if (!payload.submission) {
            return
        }

        const sheetID = payload.submission['sheet-id']

        log.debug('add sheet id', sheetID)

        if (worker.isRunningJob(`^${sheetID}.*`)) {
            axios.post(payload.response_url, util.TextWithRestartJob(`${payload.submission['sheet-id']} is running, you mean restart`, sheetID))
        } else {
            db.SlackUser.get({ user_id: payload.user.id })
                .then(userRes => {
                    log.debug(userRes.data)
                    log.debug('stoped sheetID', sheetID)

                    if (userRes.data.data[0].sheets.includes(sheetID)) {
                        axios.post(payload.response_url, util.TextWithRestartJob(`${payload.submission['sheet-id']} was be add but stopped  you mean start`, sheetID))
                    } else {
                        const newSheets = [...userRes.data.data[0].sheets, sheetID]

                        log.debug('new sheet list', newSheets)

                        const query = {
                            query: JSON.stringify({
                                user_id: payload.user.id,
                            }),
                            value: JSON.stringify({
                                sheets: newSheets,
                            }),
                        }

                        db.SlackUser.update(query)
                            .then(() => {
                                axios.post(payload.response_url, util.TextWithSettings(`Add  ${payload.submission['sheet-id']} success`))

                                worker.startCronUser(userRes.data.data[0], [sheetID])
                            })
                            .catch(err => {
                                log.error(err)
                                axios.post(payload.response_url, util.TextWithSettings(`Add ${payload.submission['sheet-id']} error`))
                            })
                    }
                })
                .catch(err => {
                    log.error(err)
                    axios.post(payload.response_url, util.TextWithSettings(`Add ${payload.submission['sheet-id']} error`))
                })
        }
    } else if (payload.callback_id === 'remove-sheet-id') {
        if (!payload.submission) {
            return
        }

        // remove all current job
        worker.clearAllJobMatch(`^${payload.submission['sheet-id']}.*`)
        db.SlackUser.get({ user_id: payload.user.id })
            .then(userRes => {
                log.debug(userRes.data)

                const newSheets = userRes.data.data[0].sheets.filter(sheet => {
                    return sheet !== payload.submission['sheet-id']
                })

                const query = {
                    query: JSON.stringify({
                        user_id: payload.user.id,
                    }),
                    value: JSON.stringify({
                        sheets: newSheets,
                    }),
                }

                db.SlackUser.update(query)
                    .then(() => {
                        axios.post(payload.response_url, util.TextWithSettings(`Remove ${payload.submission['sheet-id']} success`))
                    })
                    .catch(err => {
                        log.error(err)
                        axios.post(payload.response_url, util.TextWithSettings(`Remove ${payload.submission['sheet-id']} error`))
                    })
            })
            .catch(err => {
                log.error(err)
                axios.post(payload.response_url, util.TextWithSettings(`Remove ${payload.submission['sheet-id']} error`))
            })
    } else if (payload.callback_id === 'restart') {
        if (payload.actions[0].value) {
            log.debug(payload.actions[0].value)
            worker.clearAllJobMatch(`^${payload.actions[0].value}.*`)
            try {
                const userRes = await db.SlackUser.get({ user_id: payload.user.id })

                log.debug('restart sheet ', payload.actions[0].value, 'user', userRes.data.data[0])

                worker.startCronUser(userRes.data.data[0], [payload.actions[0].value])
            } catch (err) {
                log.error(err)
                axios.post(payload.response_url, util.TextWithSettings(`Start sheet ${payload.actions[0].value} error`))
            }
        }
    }
})

module.exports = router
