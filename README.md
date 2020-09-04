# Getting started

## Docker Compose
```sh
docker-compose up // -d for detached mode
docker-compose down // once done
```

* Will be listening at http://localhost:32767

## Local

1. install influxdb locally or run in separate container
2. change url to localhost and token in DAO.ts
3. npm i
4. npm start

* expects time as epoch timestamp in ms (or default JS Date for queries)
* expects GET request with query params, e.g: http://localhost:32767/data?since=1599175705697&until=1599179705697&sensorId=xxxx
* alerts run on a setInterval that queries all predefined alerts and if it returns any result, sends sms/email with no state change/confirmation -- will keep sending
* kept alerts as in-memory object to avoid adding another database; can setup checks and notifications on db itself
