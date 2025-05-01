const express = require('express')
const router = express.Router()
const {pool} = require('../query')

const getNetworks = async () => {
    const [rows] = await pool.query("SELECT * FROM networks")
    return rows
}   

const getNetworksWithBandwidth = async () => {
    const [rows] = await pool.query(`
      SELECT 
        n.*, 
        b.upload, 
        b.download,
        b.created_at AS bandwidth_timestamp
      FROM networks n
      LEFT JOIN (
        SELECT b1.*
        FROM bandwidth b1
        JOIN (
          SELECT device_id, MAX(created_at) AS latest_time
          FROM bandwidth
          GROUP BY device_id
        ) latest
        ON b1.device_id = latest.device_id AND b1.created_at = latest.latest_time
      ) b
      ON n.id = b.device_id
    `);
    return rows;
  };

  
const blockedDevices = async () => {
    const [rows] = await pool.query("SELECT * FROM networks WHERE status = ?", ["blocked"])
    return rows
}

const unblockDevices = async (id) => {
    const [result] = await pool.query("UPDATE networks set status = ? WHERE id = ?", ["Active", [id]])
    return result
}

router.get('/', async(req, res) => {
    try{
        const networks = await getNetworks()
        res.send(networks)
    }
    catch(err){
        res.status(500).send({error: err.message})
    }
})

router.get('/bandwidths', async(req, res) => {
    try{
        const networkWithBandwidth = await getNetworksWithBandwidth()
        res.status(200).send(networkWithBandwidth)
    }
    catch(err){
        res.status(500).send({error: err.message})
    }
})

router.get('/blocked', async(req, res) => {
    try{
        const blocked = await blockedDevices()
        res.status(200).send(blocked)
    }
    catch(err){
        res.status(500).send({error: err.message})
    }
})

router.put('/unblock/:id', async(req, res) => {
    const {id} = req.params
    try{
        const blocked = await unblockDevices(id)
        res.status(201).send(blocked)
    }
    catch(err){
        res.status(500).send({error: err.message})
    }
})

module.exports = router