import express = require('express');
import Joi = require('@hapi/joi');

import { IMessageBody } from './alertService';

const router = express.Router();

// influx has monitoring checks and notifications, can build some on top of grafana; 
// can replace with mongo repository and/or event scheduling/CRON job
const alerts_repo = [{
    "id": 1,
    "query": "from(bucket: \"sensors\") \n|> range(start: -1h, stop: now()) \n|> filter(fn: (r) => r._value > 5)",
    "body": {
        "from": "your-alert@service.com",
        "to": "email@example.com",
        "subject": "Sensor Alert Triggered",
        "text": "sensor value > 42"
    },
    "frequency": 60,
    "type": "email"
},
{
    "id": 2,
    "query": "from(bucket: \"sensors\") \n|> range(start: -15h, stop: now()) \n|> filter(fn: (r) => r._value > 42)",
    "body": {
        "body": "sensor alert triggered; value > 42",
        "from": "+1501712266",
        "to": "+15558675310"
    },
    "frequency": 60,
    "type": "sms"
},
{
    "id": 3,
    "query": "from(bucket: \"sensors\") \n|> range(start: -15h, stop: now()) \n|> filter(fn: (r) => r.sensorId == \"abcd\" and r._value > 42)",
    "body": {
        "body": "sensor alert triggered; value > 42 and sensorId = abcd",
        "from": "+1501712266",
        "to": "+15558675310"
    },
    "frequency": 60,
    "type": "sms"
}];

const validationOptions = {
    abortEarly: true, // abort after the first validation error
    allowUnknown: true
};

const message_body = Joi.object().keys({
    from: Joi.string().required(),
    to: Joi.string().required(),
    subject: Joi.string().optional(),
    body: Joi.string().optional(),
    text: Joi.string().optional()
});

const create_alert_schema = Joi.object().keys({
    sensorId: Joi.string().min(4).optional(), // subscribe to all sensors
    frequency: Joi.number().integer().required(), // job frequency; not used, can be replaced with CRON job 
    query: Joi.string().min(6).required(), // can change to threshold on specific fields from form
    type: Joi.string().required(), // sms or email
    body: message_body,
});

export const alerts = (read: any, logger: any): express.Router => {

    const alerts_service = {
        email: (body: IMessageBody) => {
            logger.info({ msg: 'sending email', body });
        },
        sms: (body: IMessageBody) => {
            logger.info({ msg: 'sending sms', body });
        }
    };

    // can schedule crons that check for previous time period on every period
    // no logic for checking whether notification was already sent
    const alerts_queue = async (alerts: any[]) => {
        const queue = [...alerts];
        let count = 0;
        while (queue.length > 0) {
            const { query, type, body } = queue.pop();
            try {
                const results = await read(query);

                if (results.length > 0) {
                    count++;

                    if (type === 'sms') {
                        alerts_service.sms(body);
                    } else if (type === 'email') {
                        alerts_service.email(body);
                    }
                }
            } catch (e) { }
        }
        if (count === 0) {
            logger.info({ msg: 'No alerts triggered' });
        }
    }

    router.get('/', (_req: express.Request, res: express.Response) => {
        return res.json(alerts_repo);
    });

    router.post('/', async (req: express.Request, res: express.Response) => {
        const { value: data, error: val_error } = create_alert_schema.validate(
            req.body,
            validationOptions
        );

        if (val_error) {
            logger.error('[createAlert]: input validation failed', { error: val_error });
            return res.sendStatus(400);
        }

        try {
            await read(data.query);
        } catch (error) {
            logger.error({ msg: '[createAlert]: error testing query', query: data.query, error });
            return res.sendStatus(400);
        }

        data.id = alerts_repo.length + 1;

        alerts_repo.push(data)
        return res.sendStatus(201);
    });

    setInterval(() => {
        alerts_queue(alerts_repo);
    }, 30 * 1000)
    return router;
}


// import { alertService } from './alertService';
// const alerts_service = alertService({
//     smtp: {
//         host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
//         port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 2525,
//         user: process.env.SMTP_USER || 'put_your_username_here',
//         pass: process.env.SMTP_PASS || 'put_your_password_here'
//     },
//     twilio: {
//         accountSid: process.env.TWILIO_ACCOUNT_SID || '',
//         token: process.env.TWILIO_AUTH_TOKEN || ''
//     }
// })