"use strict"

const Fs     = require ("fs")
const Path   = require ("path")

const Axios  = require ("axios")
const Router = require ("koa-router")

const build_controller = ([ namespace, fns ]) =>
    Object.entries(fns)
        .filter(([ name ]) => name[0] !== "_")
        .map(([ function_name, fn ]) =>
            ({ name: `${namespace}.${function_name}`, fn }))

const register = controllers_obj =>
    Object.entries(controllers_obj)
        .reduce((acc, x) => acc.concat(build_controller(x)), [])
        .reduce((acc, { name, fn }) => ({ ...acc, [name]: fn }), {})

const handle_controllers = router => async ctx => {
    const { __fn__, ...body } = ctx.request.body
    const controller = router[__fn__]
    if (controller) {
        ctx.body = await controller(ctx, body)
    } else {
        ctx.body = { error: "not found", status: 404 }
    }
}

// TODO: improve auto generated docs
const handle_docs = docs => ctx => {
    ctx.body = docs
}

const route = (prefix = "/api", controllers) => {

    const router = register (controllers)
    const docs = Object.entries(router).map(([ key ]) => key)

    return new Router({ prefix })
        .get("/docs", handle_docs (docs))
        .post("/", handle_controllers (router))
        .routes()
}

const serve = (prefix, controller_folder) => {
    const path = Path.resolve()
    const files = Fs.readdirSync(`${path}/${controller_folder}`)
    const controllers = files.filter(f => f[0] !== "_").reduce ((acc, f) => {
        if (f[0] === '_') return acc
        const key = f.replace("-controller", "").replace(".js", "")
        return { ...acc, [key]: require(`${path}/${controller_folder}/${f}`) }
    }, {})
    return route (prefix, controllers)
}

const fetch = domain => (function_name, body = {}, headers_or_token) => {
    const authorization
        = headers_or_token === undefined ? {}
        : typeof headers_or_token === "string" ? { Authorization: `Bearer ${headers_or_token}` }
        : headers_or_token

    const url = domain + "?" + function_name
    const body_ = JSON.stringify({ ...body, __fn__: function_name })
    const headers =
        { "Content-Type": "application/json"
        , ...authorization
        }

    if (this.fetch) {
        return this.fetch(url, { method: "POST", body: body_, headers })
            .then(_ => _.json())
            .catch(_ => null)
    } else {
        return Axios({ method: "POST", url, data: body_, headers })
            .then(_ => _.data)
            .catch(err => ({ status: 500, error: err.message }))
    }
}

module.exports = { route, serve, fetch }
