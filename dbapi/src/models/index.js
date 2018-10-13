const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const uri = `mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME}:${
    process.env.MONGO_INITDB_ROOT_PASSWORD
}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${
    process.env.MONGO_DBNAME
}?authSource=admin`

mongoose.connect(
    uri,
    { useNewUrlParser: true },
)

const db = {}

fs.readdirSync(__dirname)
    .filter(file => {
        return file.indexOf('.') !== 0 && file !== 'index.js'
    })
    .forEach(file => {
        const model = require(path.join(__dirname, file))

        db[model.modelName] = model
    })

db.mongoose = mongoose

module.exports = db