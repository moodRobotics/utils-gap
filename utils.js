// v.1.0.0

const https = require('https')
const querystring = require('querystring')
const http = require('http')
const tls = require('tls')
const fs = require('fs')
const { proxySettings } = require('tor-request')

exports.log = function (type, msg) {
  log(type, msg)
}
function log(type, msg) {
  const ahora = new Date()
  var hours = ahora.getHours() < 10 ? '0' + ahora.getHours() : ahora.getHours()
  var minutes =
    ahora.getMinutes() < 10 ? '0' + ahora.getMinutes() : ahora.getMinutes()
  console.log(hours + ':' + minutes + ' - ' + type + ': ' + msg)
}

exports.getJSON = async function (url) {
  // return https.get(url);

  https
    .get(url, (res) => {
      let body = ''

      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        try {
          let json = JSON.parse(body)
          // console.error(body)
          // do something with JSON
          return json
        } catch (error) {
          console.error(error.message)
        }
      })
    })
    .on('error', (error) => {
      console.error(error.message)
    })
}

exports.getDATA = async function (url) {
  https
    .get(url, (res) => {
      let body = ''

      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        try {
          return body
        } catch (error) {
          console.error(error.message)
        }
      })
    })
    .on('error', (error) => {
      console.error(error.message)
    })
}
// function to encode file data to base64 encoded string
exports.base64_encode = function (file) {
  // read binary data
  var bitmap = fs.readFileSync(file)
  // convert binary data to base64 encoded string
  return bitmap.toString('base64')
}

exports.sleep = function (ms) {
  if (ms < 60001) {
    log('info', 'Esperando ' + ms / 1000 + ' segundos.')
  } else if (ms < 3600000) {
    log('info', 'Esperando ' + ms / 60000 + ' minutos.')
  } else if (ms == 3600000) {
    log('info', 'Esperando 1 hora.')
  } else {
    log('info', 'Esperando ' + ms / 3600000 + ' horas.')
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

exports.post = function (host, path, data) {
  var postData = querystring.stringify({ data: JSON.stringify(data) })
  var options = {
    hostname: host,
    port: 443,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length,
    },
  }
  // console.log("https://"+host+path)
  var req = https.request(options, (res) => {
    res.setEncoding('utf8')

    res.on('data', function (chunk) {
      var resultado = { error: true, msg: chunk }
      if (chunk.substr(0, 1) == '{') {
        resultado = JSON.parse(chunk)
      }
      if (resultado.error) {
        console.error('error servidor: ' + resultado.msg)
        stop = true
        process.exit(1)
      }
    })
  })

  req.on('error', (e) => {
    console.log('error')
    console.error(e)
  })

  req.write(postData)
  req.end()
}

// function returns a Promise
function postPromise(host, path, data) {
  return new Promise((resolve, reject) => {
    var postData = querystring.stringify({ data: JSON.stringify(data) })
    var options = {
      hostname: host,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
      },
    }
    // console.log("https://"+host+path)
    var req = https.request(options, (res) => {
      // Detect a redirect
      if (
        res.statusCode > 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        // The location for some (most) redirects will only contain the path,  not the hostname;
        // detect this and add the host to the path.
        const url = new URL(res.headers.location)
        let host = url.hostname
        let path = url.pathname + '?' + url.search

        if (host) {
          // Hostname included; make request to res.headers.location
          // console.log('redirect:' + path)
          let respuesta = postPromise(host, path, data)
          resolve(respuesta)
        } else {
          // Hostname not included; get host from requested URL (url.parse()) and prepend to location.
          console.log('error postWrite Hostname not included')
        }

        // Otherwise no redirect; capture the response as normal
      } else {
        res.setEncoding('utf8')

        res.on('data', function (chunk) {
          console.log(chunk)
        })
      }
    })

    req.on('error', (e) => {
      console.log('error')
      console.error(e)
    })

    req.write(postData)
    req.end()
  })
}

exports.readJSON = function (filename) {
  let content
  try {
    content = fs.readFileSync(filename, { encoding: 'utf8' })
    content = JSON.parse(content)
  } catch (err) {
    console.log(err)
    content = false
  }
  return content
}

// write result file
exports.writeJSON = function (filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data))
}

// function returns a Promise
function getPromise(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let chunks_of_data = []
      //Comprueba si hay una redireccion
      if (
        response.statusCode > 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        if (response.headers.location.search('https:' != -1)) {
          let newlink = response.headers.location
          console.log('redirect:' + newlink)
          let respuesta = getPromise(newlink)
          resolve(respuesta)
        } else {
          // Hostname not included; get host from requested URL (url.parse()) and prepend to location.
        }
      }

      response.on('data', (fragments) => {
        chunks_of_data.push(fragments)
      })

      response.on('end', () => {
        let response_body = Buffer.concat(chunks_of_data)
        resolve(response_body.toString())
      })

      response.on('error', (error) => {
        reject(error)
      })
    })
  })
}

// function returns a Promise
function getProxyHTTPS(proxy, port, host, url) {
  var req = http.request({
    host: proxy,
    port: port,
    method: 'CONNECT',
    path: host + ':443',
  })
  return new Promise((resolve, reject) => {
    req.on('connect', function (res, socket, head) {
      var cts = tls.connect(
        {
          host: host,
          socket: socket,
        },
        function () {
          cts.write('GET / HTTP/1.1rnHost: ' + host + 'rnrn')
        },
      )

      cts.on('data', function (data) {
        console.log(data.toString())
      })
    })

    req.end()
  })
}
// async function to make http request
exports.getSync = async function (url) {
  try {
    let http_promise = getPromise(url)
    let response_body = await http_promise

    // holds response from server that is passed when Promise is resolved
    return response_body
  } catch (error) {
    // Promise rejected
    console.log(error)
  }
}
// async function to make http request
exports.postWrite = async function (host, path, data) {
  try {
    let http_promise = postPromise(host, path, data)
    let response_body = await http_promise

    // holds response from server that is passed when Promise is resolved
    return response_body
  } catch (error) {
    // Promise rejected
    console.log(error)
  }
}

exports.getJSONSync = async function (url) {
  try {
    let http_promise = getPromise(url)
    let response_body = await http_promise

    // holds response from server that is passed when Promise is resolved
    return JSON.parse(response_body)
  } catch (error) {
    // Promise rejected
    console.log(error)
  }
}

exports.getProxySync = async function (proxy, port, host, url) {
  try {
    let http_promise = getProxyHTTPS(proxy, port, host, url)
    let response_body = await http_promise

    // holds response from server that is passed when Promise is resolved
    return response_body
  } catch (error) {
    // Promise rejected
    console.log(error)
  }
}

exports.renameFile = async function (oldname, newfilename) {
  fs.rename(oldname, newfilename, function (err) {
    if (err) console.log('ERROR: ' + err)
  })
}
exports.deleteFile = async function (filename) {
  fs.unlinkSync(filename, function (err) {
    if (err) console.log('ERROR: ' + err)
  })
}
