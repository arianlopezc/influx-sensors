const nodemailer = require('nodemailer');

interface ISMTPConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
}

interface ITwilio {
    accountSid: string;
    token: string;
}

interface IAlertConfig {
    smtp: ISMTPConfig;
    twilio: ITwilio
}

export interface IMessageBody {
    from: string;
    to: string;
    subject?: string;
    body?: string;
    text?: string;
}

// not using so it doesn't need twilio or smtp config
export const alertService = (config: IAlertConfig) => {
    const {
        smtp,
        twilio
    } = config;

    const {
        host,
        port,
        user,
        pass
    } = smtp;

    const transport = nodemailer.createTransport({
        host,
        port,
        auth: {
            user,
            pass,
        }
    });

    const {
        accountSid,
        token
    } = twilio;


    const client = require('twilio')(accountSid, token)

    return {
        sms: (body: IMessageBody) => {
            const sms = body || { body: 'sensor alert triggered; value > 42', from: '+15017122661', to: '+15558675310' };

            client.messages
                .create(sms)
                .then((message: any) => console.log(message.sid));

        },
        email: (body: IMessageBody) => {
            const email = body || {
                from: 'your-alert@service.com', // Sender address
                to: 'email@example.com',         // List of recipients
                subject: 'Sensor Alert Triggered', // Subject line
                text: 'sensor value > 42' // Plain text body
            };

            transport.sendMail(email, function (err: any, info: any) {
                if (err) {
                    console.log(err)
                } else {
                    console.log(info);
                }
            });
        }
    }
}
