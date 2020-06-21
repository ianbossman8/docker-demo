const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { Pool } = require('pg')
const redis = require('redis')
const keys = require('./keys')

const app = express()

app.use(cors())
app.use(bodyParser.json())

const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  port: keys.pgPort,
  database: keys.pgDatabase,
  password: keys.pgPassword,
})

pgClient.on('error', () => console.error('Lost PG Connection'))

pgClient.on('connect', () => {
  pgClient
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch((error) => console.error(error))
})

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
})

const redisPublisher = redisClient.duplicate()

app.get('/', (_, res) => {
  res.send('Hi')
})

app.get('/values/all', async (_, res) => {
  const values = await pgClient.query('SELECT * from values')

  res.send(values.rows)
})

app.get('/values/current', async (_, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values)
  })
})

app.post('/values', async (req, res) => {
  const index = req.body.index

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high')
  }

  redisClient.hset('values', index, 'Nothing yet')
  redisPublisher.publish('insert', index)
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index])

  res.send({ working: true })
})

app.listen(5000, () => {
  console.log('Listening at 5000')
})
