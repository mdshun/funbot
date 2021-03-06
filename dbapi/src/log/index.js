require('dotenv').config({ path: `../../${process.env.FUNBOT_ENV}.env` })

const Log4js = require('log4js')

function devConfig() {
    return {
        appenders: {
            console: {
                type: 'console',
            },
            slack: {
                type: '@log4js-node/slack',
                token: process.env.SLACK_ALERT_TOKEN,
                channel_id: 'reminder-log',
                username: 'dbapi-log',
            },
        },
        categories: {
            default: {
                appenders: ['console'],
                level: 'debug',
            },
        },
    }
}

function prodConfig() {
    return {
        appenders: {
            everything: {
                type: 'dateFile',
                filename: '/funbot/logs/dbapi-system.log',
                pattern: '-yyyy-MM-dd',
            },
            slack: {
                type: '@log4js-node/slack',
                token: process.env.SLACK_ALERT_TOKEN,
                channel_id: 'dbapi-alerts',
                username: 'db-api-alerts',
            },
        },
        categories: {
            default: {
                appenders: ['slack', 'everything'],
                level: 'info',
            },
        },
    }
}

switch (process.env.FUNBOT_ENV) {
    case 'dev':
        Log4js.configure(devConfig())
        break
    case 'prod':
        Log4js.configure(prodConfig())
        break
    default:
        Log4js.configure(prodConfig())
        break
}

const logger = Log4js.getLogger()

logger.info(`you are running in ${process.env.FUNBOT_ENV} environment`)

module.exports = logger
