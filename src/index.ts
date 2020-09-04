import express = require('express');
import bodyParser = require('body-parser');
import Joi = require('@hapi/joi');
const logger = require('pino')();

import { DAO } from './DAO'

const org = 'org';
const bucket = process.env.INFLUXDB_DB || 'sensors';

/* set it in docker-compose or pass at runtime for testing purposes */
const token = process.env.INFLUX_TOKEN || 'token123';

const { read, write } = DAO({ org, bucket, token, logger });

const validationOptions = {
    abortEarly: true, // abort after the first validation error
    allowUnknown: false
};

const put_validation_schema = Joi.object().keys({
    sensorId: Joi.string().min(4).required(),
    time: Joi.number().integer().required(),
    value: Joi.number().required()
});

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));

app.put('/data', async (req: express.Request, res: express.Response) => {
    const { sensorId = null, time = null } = req.body;

    // if missing values
    if (!sensorId || !time) {
        logger.info('[putData]: missing or invalid request params');
        return res.sendStatus(400);
    }

    try {
        const { value: data, error: val_error } = put_validation_schema.validate(
            req.body,
            validationOptions
        );

        if (val_error) {
            logger.error('[putData]: input validation failed', { error: val_error });
            return res.sendStatus(400);
        }

        const dto = {
            uid: `${data.sensorId}-${data.time}`, // unique sensorId + time
            ...data,
        }

        const query = `from(bucket: "${bucket}")
        |> range(start: ${new Date(dto.time).toISOString()}, stop: now())
        |> filter(fn: (r) => r.uid == "${dto.uid}")`;

        const duplicates: any[] = await read(query);

        if (duplicates.length > 0) {
            logger.error({ msg: '[putData]: duplicate entries', duplicates });
            return res.sendStatus(409);
        }

        await write(dto);
        logger.info({ msg: '[putData]: wrote data successfully', data: dto });
        res.sendStatus(204);

    } catch (e) {
        logger.error({ msg: '[putData]: error writing data', error: e });
        res.status(500).send(e);
    }
});

// - `sensorId`: the sensor id for which to query data;
// - `since`: a lower bound on the time of the data; // required
// - `until`: an upper bound on the time of the data.

const query_validation_schema = Joi.object().keys({
    sensorId: Joi.string().min(4).optional(),
    since: Joi.number().integer().required(),
    until: Joi.number().integer().optional()
});

app.get('/data', async (req: express.Request, res: express.Response) => {
    const { value: data, error: val_error } = query_validation_schema.validate(
        req.query,
        validationOptions
    );

    if (val_error) {
        logger.error({ msg: '[getData]: input validation failed', error: val_error });
        return res.sendStatus(400);
    }

    const start = `|> range(start: ${new Date(data.since).toISOString()}`
    const range = data.until ?
        `${start}, stop: ${new Date(data.until).toISOString()})` :
        start + ')';

    const filter = data.sensorId ? `|> filter(fn: (r) => r.sensorId == "${data.sensorId}")` : '';

    const query = `from(bucket: "${bucket}") ${range} ${filter}`;

    try {
        const results = await read(query);
        return res.json(results);
    } catch (e) {
        logger.error({ msg: '[getData]: error querying data', error: e });
        return res.sendStatus(500);
    }
});

import { alerts } from './routes/alerts';
app.use('/alerts', alerts(read, logger));

const port = 32767;
app.listen(port, () => {
    console.log(`server listening on port: ${port}`);
});
