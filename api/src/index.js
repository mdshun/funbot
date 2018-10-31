if (!process.env.VERSION) {
    require('dotenv').config({ path: '../../.env' })
}

const express = require('express')
const bodyParser = require('body-parser')

const log = require('./log')

const api = express()

api.use(bodyParser.urlencoded({ extended: true }))
api.use(bodyParser.json())

api.use(require('./routers'))

const server = api.listen(process.env.API_PORT || 8080, () => {
    log.debug(`Listening on port ' ${server.address().port}`)
})

// starting worker
const worker = require('./worker')

worker.start()
