const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const app = express()
app.use(cors())
app.use(cors({
    origin: "*",
    methods: ["GET", "PUT", "DELETE"]
}))
app.use(express.json())
app.use(express.urlencoded({extended: true}))

const networkRoute = require('./routes/networks')
const bandwidthRoute = require('./routes/bandwidth')
const notificationRoute = require('./routes/notification')

app.get('/', (req, res) => {
    res.send("Hello from NetDetect!")
})

app.use('/networks', networkRoute)
app.use('/bandwidth', bandwidthRoute)
app.use('/notification', notificationRoute)


const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

module.exports = app