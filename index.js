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

const handle_controller = async (ctx, router, req) => {
    const { __fn__, ...body } = req
    const controller = router[__fn__]
    return controller
        ? await controller(ctx, body)
        : { error: "not found", status: 404 }
}

const handle_controllers = router => async ctx => {
    const multi = Array.isArray(ctx.request.body.__multi__)
    ctx.body = multi
        ? await Promise.all(ctx.request.body.__multi__.map(req => handle_controller(ctx, router, req)))
        : await handle_controller(ctx, router, ctx.request.body)
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

const fetch_one = (domain, function_name, body, headers_or_token) => {
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

const fetch_list = (domain, fetchList, headers_or_token) => {
    const authorization
        = headers_or_token === undefined ? {}
        : typeof headers_or_token === "string" ? { Authorization: `Bearer ${headers_or_token}` }
        : headers_or_token
    
    const url = domain + "?multi"
    const __multi__ = fetchList.map(([ function_name, body = {} ]) => ({ ...body, __fn__: function_name }))
    const body_ = JSON.stringify({ __multi__ })
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

const fetch = domain => (a, b, c) => {
    return Array.isArray (a)
        ? fetch_list (domain, a, b)
        : fetch_one (domain, a, b, c)
}

module.exports = { route, serve, fetch }
