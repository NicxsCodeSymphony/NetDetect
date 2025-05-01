const express = require('express')
const router = express.Router()
const {pool} = require('../query')

const getNotification = async() => {
    const [rows] = await pool.query("SELECT * FROM notification")
    return rows
}

router.get('/', async(req, res) => {
    try{
        const result = await getNotification()
        res.status(200).send(result)
    }
    catch(err){
        console.error({error: err.message})
    }
})

module.exports = router