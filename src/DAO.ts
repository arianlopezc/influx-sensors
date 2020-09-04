const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const os = require("os");
const hostname = os.hostname();

interface IDao {
    org: string;
    bucket: string;
    token: string;
    logger: any;
}

interface DataPoint {
    uid: string;
    sensorId: string;
    value: number;
    time: number | Date;
}

export const DAO = ({ org, bucket, token, logger }: IDao) => {

    const client = new InfluxDB({
        url: 'http://influxdb:8086',
        token
    });

    const writeApi = client.getWriteApi(org, bucket);
    writeApi.useDefaultTags({ host: hostname });

    const write = (data: DataPoint) => {
        const point = new Point('sensor_reading')
            .tag('uid', data.uid)
            .tag('sensorId', data.sensorId)
            .floatField('value', data.value)
            .timestamp(new Date(data.time));

        writeApi.writePoint(point);
        return writeApi.flush()
    }


    const queryApi = client.getQueryApi(org);

    const read = (query: string): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const data: any[] = [];
            queryApi.queryRows(query, {
                next(row: any, tableMeta: any) {
                    const o = tableMeta.toObject(row)
                    data.push(o);
                },
                error(error: Error) {
                    console.error({ error });
                    logger.error({ msg: 'error querying influxDB', query, error });
                    return reject(error);
                },
                complete() {
                    logger.info({ msg: 'data from query', query, data });
                    return resolve(data);
                },
            });
        });
    }

    return {
        read,
        write
    };
}