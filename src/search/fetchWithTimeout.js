// https://stackoverflow.com/questions/46946380/fetch-api-request-timeout

export default function (url, options, timeout = 10000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('fetch timeout')), timeout)
        )
    ]);
}