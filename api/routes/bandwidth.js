const express = require('express')
const router = express.Router()
const {pool} = require('../query')

const getBandwidth = async () => {
    const [rows] = await pool.query("SELECT * FROM bandwidth")
    return rows
}

const getBandwidthWithId = async(id) => {
    const [rows] = await pool.query("SELECT * FROM bandwidth WHERE device_id = ? ", [id])
    return rows
}

const getBandwidthTotals = async() => {
    const [rows] = await pool.query(`
        SELECT 
            SUM(download) as total_download,
            SUM(upload) as total_upload,
            SUM(download + upload) as total_usage
        FROM bandwidth
    `)
    return rows[0] 
}

// API

router.get('/', async(req, res) => {
    try{
        const bandwidth = await getBandwidth()
        res.status(200).send(bandwidth)
    }
    catch(err){
        res.status(500).send({error: err.message})
    }
})

router.get('/totals', async(req, res) => {
    try{
        const totals = await getBandwidthTotals()
        res.status(200).send(totals)
    }
    catch(err){
        res.status(500).send({error: err.message})
    }
})

router.get('/:id', async(req, res) => {
    const {id} = req.params
    try{
        const bandwidth = await getBandwidthWithId(id)
        if (bandwidth.length === 0) {
            return res.status(404).send({message: "Device not found"})
        }
        res.status(200).send(bandwidth)
    }
    catch(err){
        res.status(500).send({error: err.message})
    }
})

module.exports = router