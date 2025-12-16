// I thank God for allowing me to program.


let stack = []

let env = make_env()
const root = env
const w = env.word

let source = ''
let pointer = 0

const special = identity_group('{ [ ( ` " ) ] }')

const number_regex = /^-?\d+(\.?\d*)$/

let make_fun = make_sub

let catch_code = (x) => { console.error(x) }

const default_catch = catch_code

let compile_into_list = compile_in_list

const escape = { r: "\r", n: "\n", 0: "\0", t: "\t" }

function error (...message)
{
  env = root
  throw Error(message.map(x => typeof x === 'string'? x : JSON.stringify(x)).join(' '))
}

function make_env (parent)
{
  return { parent: parent, word: {} }
}

function identity_group (str_or_list)
{
  if (typeof str_or_list === 'string')
  {
    str_or_list = str_or_list.split(' ')
  }
  const obj = {}
  for (let element of str_or_list)
  {
    obj[element] = 1
  }
  return obj
}

function read_word ()
{
  let word = ''
  let chr = source[pointer++]
  while (chr !== undefined && chr.match(/\s/))
  {
    chr = source[pointer++]
  }
  while (chr !== undefined && !chr.match(/\s/))
  {
    if (special[chr])
    {
      if (word === '')
      {
        return chr
      }
      else
      {
        pointer--
        return word
      }
    }
    word += chr
    chr = source[pointer++]
  }

  if (word !== '')
  {
    return word
  }
}

function put (...stuff)
{
  stack.push(...stuff)
}

function get ()
{
  if (stack.length)
  {
    return stack.pop()
  }
  else
  {
    error('stack underflow')
  }
}

function getn (num)
{
  if (num)
  {
    if (stack.length < num)
    {
      error('getn stack underflow', num)
    }
    else
    {
      return stack.splice(-num)
    }
  }
  else
  {
    return []
  }
}

function get2 ()
{
  if (stack.length < 2)
  {
    error('stack underflow 2')
  }
  else
  {
    return stack.splice(-2)
  }
}

function get3 ()
{
  if (stack.length < 3)
  {
    error('stack underflow 3')
  }
  else
  {
    return stack.splice(-3)
  }
}

function get4 ()
{
  if (stack.length < 4)
  {
    error('stack underflow 4')
  }
  else
  {
    return stack.splice(-4)
  }
}

function find (name)
{
  if (env.word[name])
  {
    return env.word[name]
  }
  else if (env.parent)
  {
    let e = env
    while (e = e.parent)
    {
      if (e.word[name])
      {
        return e.word[name]
      }
    }
  }
}

function search (name)
{
  if (env.word[name])
  {
    return env
  }
  else if (env.parent)
  {
    let e = env
    while (e = e.parent)
    {
      if (e.word[name])
      {
        return e
      }
    }
  }
}

function compile_element (element)
{
  const type = typeof element
  if (type === 'string')
  {
    const word = find(element)
    if (word)
    {
      if (word.hasOwnProperty('immediate'))
      {
        word()
        if (word.immediate)
        {
          return get()
        }
      }
      else
      {
        return word
      }
    }
    else
    {
      return compile_atom(element)
    }
  }
  else if (type === 'function')
  {
    return element
  }
  else if (Array.isArray(element))
  {
    return compile_list(element)
  }
  else
  {
    return () => { put(element) }
  }
}

function compile_in_list (element, list)
{
  const value = compile_element(element)
  if (value)
  {
    list.push(value)
  }
}

function make_sub (list)
{
  const compiled_unit = () => { for (let element of list) { element() } }
  return compiled_unit
}

function make_async_sub (list)
{
  const asynchronous_compiled_unit = async () =>
  {
    for (let element of list)
    {
      element();
      if (stack[stack.length - 1] instanceof Promise)
      {
        const promise = stack.pop()
        try
        {
          const result = await promise
          if (result !== undefined)
          {
            put(result)
          }
        }
        catch (e)
        {
          catch_code(e)
        }
      }
    }
  }
  return asynchronous_compiled_unit
}

function compile_list (list)
{
  const code = []
  for (let element of list)
  {
    if (Array.isArray(element))
    {
      code.push(() => put(element))
    }
    else
    {
      compile_into_list(element, code)
    }
  }
  return make_fun(code)
}

function compile_atom (atom)
{
  if (atom.match(number_regex))
  {
    const number = parseFloat(atom)
    return () => put(number)
  }
  else if (atom.startsWith("'"))
  {
    const string = atom.substr(1)
    return () => put(string)
  }
  else if (atom.startsWith(':'))
  {
    if (atom.endsWith(':'))
    {
      const name = atom.substr(1, atom.length - 2)
      const delayed_binding_and_value_push = () =>
      {
        const value = get()
        const runtime_binding = () => put(runtime_binding.value)
        runtime_binding.value = value
        env.word[name] = runtime_binding
        put(value)
      }
      return delayed_binding_and_value_push
    }
    else
    {
      const name = atom.substr(1)
      const delayed_binding = () =>
      {
        const value = get();
        const runtime_binding = () => put(runtime_binding.value)
        runtime_binding.value = value
        env.word[name] = runtime_binding
      }
      return delayed_binding
    }
  }
  else if (atom.endsWith(':'))
  {
    const name = atom.substr(0, atom.length - 1)
    const delayed_lookup = () => { const word = find(name); undef(word, atom, 'does not exist at runtime'); word() }
    return delayed_lookup
  }
  else if (atom.startsWith('.'))
  {
    if (atom.endsWith('!'))
    {
      return compile_stack_dot_notation(atom.substr(1, atom.length - 2), (slot, property) => slot[property] = get())
    }
    else
    {
      return compile_stack_dot_notation(atom.substr(1), (slot, property) => put(slot[property]))
    }
  }
  else if (atom.match(/\./))
  {
    if (atom.endsWith('!'))
    {
      return compile_dot_notation(atom.substr(0, atom.length - 1), (slot, property) => slot[property] = get())
    }
    else
    {
      return compile_dot_notation(atom, (slot, property) => put(slot[property]))
    }
  }
  else if (atom.startsWith('--'))
  {
    const method_name = atom.substr(2)
    return () => { const [obj, args] = get2(); put(obj[method_name](...args)) }
  }
  else if (atom.startsWith('-'))
  {
    const method_name = atom.substr(1)
    return () => { put(get()[method_name]()) }
  }
  else if (atom.startsWith('~~'))
  {
    const method_name = atom.substr(2)
    return () => { const [obj, args] = get2(); obj[method_name](...args) }
  }
  else if (atom.startsWith('~'))
  {
    const method_name = atom.substr(1)
    return () => { get()[method_name]() }
  }
  else
  {
    error(atom, 'not recognized')
  }
}

//ats

function compile_string (string)
{
  const old = source
  const oldp = pointer
  source = string
  pointer = 0
  const code = []
  let element
  while ((element = read_word()) !== undefined)
  {
    compile_into_list(element, code)
  }
  const compiled_unit = make_fun(code)
  source = old
  pointer = oldp
  return compiled_unit
}

function interpret_element (element)
{
  const value = compile_element(element)
  if (value)
  {
    value()
  }
}

function interpret_string (string)
{
  compile_string(string)()
}

function node ()
{
  function repl ()
  {
    const handler = function (data)
    {
      const string = data.toString()
      if (string === '\n')
      {
        process.stdin.pause()
        process.stdin.removeListener('data', handler)
      }
      else
      {
        try
        {
          interpret_string(string.trim())
          console.log(stack)
        }
        catch (e)
        {
          console.error(e)
        }
      }
    }
    process.stdin.on('data', handler)
  }
  repl()
}

function browser ()
{
  let ctx, animation, canvas, user_style
  const style = document.createElement('style')
  document.head.appendChild(style)
  style.sheet.insertRule('oh { display: none }')
  w.alert = () => alert(get())
  w.params = () => put(new URLSearchParams(location.search))
  w.query = () => { put(Object.fromEntries(new  URLSearchParams(location.search))) }
  w.body = () => put(document.body)
  w.window = () => put(window)
  w.document = () => put(document)
  w.element = () => put(document.createElement(get()))
  w['add-font'] = () =>
  {
    const [type, url] = get2()
    document.fonts.add(new FontFace(type, 'url("' + url + '")'))
  }
  w['set-ctx'] = () => ctx = get().getContext('2d')
  w.canvas = () => put(canvas)
  w.style = () =>
  {
    if (!user_style)
    {
      user_style = document.createElement('style')
      document.head.appendChild(user_style)
    }
    user_style.textContent = css(get())
  }
  w['style-append'] = () =>
  {
    if (!user_style)
    {
      user_style = document.createElement('style')
      document.head.appendChild(user_style)
    }
    user_style.textContent += css(get())
  }
  w.clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height)
  w['make-canvas'] = () =>
  {
    canvas = document.createElement('canvas')
    ctx = canvas.getContext('2d')
    canvas.width = innerWidth
    canvas.height = innerHeight
    window.addEventListener('resize', () => { canvas.width = innerWidth; canvas.height = innerHeigth })
    document.body.style.overflow = 'hidden'
    document.body.style.margin = 0
    document.body.style.padding = 0
    document.body.appendChild(canvas)
  }
  w.rectangle = () => ctx.fillRect(...get4())
  w.color = () => ctx.fillStyle = get()
  w.animation = () =>
  {
    const code = get()
    if (animation)
    {
      cancelAnimationFrame(animation)
    }
    const fun = () => { code(); animation = requestAnimationFrame(fun) }
    animation = requestAnimationFrame(fun)
  }
  w['to-body'] = () =>
  {
    const element = get()
    if (Array.isArray(element))
    {
      for (let el of element)
      {
        document.body.appendChild(el)
      }
    }
    else
    {
      document.body.appendChild(element)
    }
  }
  w.append = () =>
  {
    const [child, parent] = get2()
    if (Array.isArray(child))
    {
      for (let element of child)
      {
        parent.appendChild(element)
      }
    }
    else
    {
      parent.appendChild(child)
    }
  }
  w.image = () =>
  {
    const src = get()
    put(new Promise((res, rej) =>
    {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = () => rej('image failed to load: ' + src)
      img.src = src
    }))
  }
  w.images = () =>
  {
    const sources = get()
    let count = 0
    const len = sources.length
    let resolve, reject
    const images = []
    put(new Promise((res, rej) => { resolve = res; reject = rej }))
    for (let src of sources)
    {
      const img = new Image()
      img.onload = () =>
      {
        images.push(img)
        if(++count === len)
        {
          resolve(images)
        }
      }
      img.onerror = () => reject('failed to load image: ' + src)
      img.src = src
    }
  }
  w.handler = () =>
  {
    
    let event
    const e = make_env(env)
    e.word.event = () => put(event)
    const code = env_block(e)
    put(() => 
    {
      const [element, type] = get2();
      element.addEventListener(type, (x) => { event = x; code() })
    })
  }
  w.dom = () => put(dom(get()))
  immediate(1, 'handler')
  function dom (list)
  {
    const [name, ...elements] = list
    const element = document.createElement(name)
    while (elements.length)
    {
      const directive = elements.shift()
      if (Array.isArray(directive))
      {
        element.appendChild(dom(directive))
      }
      else if (typeof directive === 'function')
      {
        directive()
        element.textContent += get()
      }
      else if (directive === 'text')
      {
        if (elements.length)
        {
          const text = elements.shift()
          if (typeof text === 'function')
          {
            text()
            element.textContent += get()
          }
          else
          {
            element.textContent += text
          }
        }
        else
        {
          error('text directive in', name, 'did not receive a value', elements)
        }
      }
      else if (directive === 'reader')
      {
        let [word_name, property] = elements.splice(0, 2)
        undef(property, 'reader directive did not receive a property name', name, elements)
        undef(word_name, 'reader directive did not receive a word name', name, elements)
        property = translate_case(property)
        env.word[word_name] = () => put(element[property])
      }
      else if (directive === 'writer')
      {
        let [word_name, property] = elements.splice(0, 2)
        undef(property, 'writer directive did not receive a property name', name, elements)
        undef(word_name, 'writer directive did not receive a word name', name, elements)
        property = translate_case(property)
        env.word[word_name] = () => { element[property] = get() }
      }
      else if (directive.startsWith('.'))
      {
        element.classList.add(directive.substr(1))
      }
      else if (directive.startsWith('#'))
      {
        element.id = directive.substr(1)
      }
      else if (directive.startsWith('-'))
      {
        if (elements.length)
        {
          let text = elements.shift()
          if (typeof text === 'function')
          {
            text()
            text = get()
          }
          else if (text === undefined)
          {
            text = ''
          }
          element.setAttribute(directive.substr(1), text)
        }
        else
        {
          error(directive, 'did not receive a value for the property', name, elements)
        }
      }
      else if (directive.startsWith(':'))
      {
        env.word[directive.substr(1)] = () => put(element)
      }
      else if (directive.startsWith('@'))
      {
        if (elements.length)
        {
          let code = elements.shift()
          if (Array.isArray(code))
          {
            let event
            const old = env
            env = make_env(env)
            env.word.event = () => put(event)
            const list = []
            for (let word of code)
            {
              const value = compile_element(word)
              if (value)
              {
                list.push(value)
              }
            }
            code = (ev) => { event = ev; for (let fun of list) { fun() } }
          }
          else if (!(typeof code === 'function'))
          {
            error(directive, 'did receive a value that is not a list or function', code, name, elements)
          }
          element.addEventListener(directive.substr(1), code)
        }
        else
        {
          error(directive, 'did not receive a function or list for', name, elements)
        }
      }
      else
      {
        error(directive, 'is not a known directive', name, elements)
      }
    }
    return element
  }
  async function load_scripts ()
  {
    for (let oh of document.getElementsByTagName('oh'))
    {
      const src = oh.getAttribute('src')
      if (src)
      {
        const res = await fetch(src)
        if (res.ok)
        {
          interpret_string(await res.text())
        }
        else
        {
          console.error('failed to load', src)
        }
      }
      const str = oh.textContent.trim()
      if (str)
      {
        interpret_string(str)
      }
      oh.remove()
    }
  }
  window.addEventListener('load', load_scripts)
}

function init ()
{
  if (typeof window === 'undefined')
  {
    node()
  }
  else
  {
    browser()
  }
}

function undef (element, ...message)
{
  if (element === undefined)
  {
    error(...message)
  }
  return element
}

function block (end = 'end')
{
  let element
  const code = []
  while ((element = read_word()) !== end)
  {
    undef(element, 'block did not find a terminating', end)
    compile_into_list(element, code)
  }
  return make_fun(code)
}

function env_block (e = env, end = 'end')
{
  let element
  const code = []
  const old = env
  env = e
  while ((element = read_word()) !== end)
  {
    undef(element, 'block did not find a terminating', end)
    compile_into_list(element, code)
  }
  env = old
  return make_fun(code)
}

function read_name (caller_name)
{
  const name = read_word()
  undef(name, caller_name, 'did not read a word')
  return name
}

function immediate (flag, str_or_list)
{
  if (typeof str_or_list === 'string')
  {
    str_or_list = str_or_list.split(' ')
  }
  for (let name of str_or_list)
  {
    const word = find(name)
    undef(word, name, 'is not a word when trying to make it immediate')
    word.immediate = flag
  }
}

function get_chain (object, properties)
{
  const len = properties.length - 1
  for (let i = 0; i < len; i++)
  {
    if (properties[i] in object)
    {
      object = object[properties[i]]
    }
    else
    {
      error(object, 'does not have a property named', properties[i], properties, len)
    }
  }
  return [object, properties[len]]
}

function compile_stack_dot_notation (name, code)
{
  const properties = translate_case(name).split('.')
  const stack_dot_assignment = function ()
  {
    code(...get_chain(get(), properties))
  }
  return stack_dot_assignment
}

function compile_dot_notation (name, code)
{
  let [object_expr, ...properties] = name.split('.')
  properties = properties.map(translate_case)
  const obj_expr = compile_element(object_expr)
  undef(obj_expr, 'compile dot assignment did not receive code from', object_expr, name)
  
  const dot_assignment = function ()
  {

    obj_expr()
    code(...get_chain(get(), properties))
  }
  return dot_assignment
}

function compile_runtime_mutation (name, code)
{
  const runtime_mutation = function ()
  {
    const word = find(name)
    undef(word, name, 'did not find a word named', name)
    if (word.hasOwnProperty('value'))
    {
      code(word, 'value')
    }
    else
    {
      error(name, 'is not a word with a binding at runtime')
    }
  }
  return runtime_mutation
}

function compile_mutation (name, code)
{
  const word = find(name)
  undef(word, name, 'did not find a word named', name)
  if (word.hasOwnProperty('value'))
  {
    const mutation = function ()
    {
      code(word, 'value')
    }
    return mutation
  }
  else
  {
    error(name, 'is not a word with a binding at compile time')
  }
}

function mutator (caller_name, code)
{
  env.word[caller_name] = () =>
  {
    const name = read_name(caller_name)
    if (name.startsWith('.'))
    {
      put(compile_stack_dot_notation(name.substr(1), code))
    }
    else if (name.match(/\./))
    {
      put(compile_dot_notation(name, code))
    }
    else if (name.endsWith(':'))
    {
      put(compile_runtime_mutation(name.substr(0, name.length - 1), code))
    }
    else
    {
      put(compile_mutation(name, code))
    }
  }
  env.word[caller_name].immediate = 1
}

function build_list ()
{
  const list = []
  let word
  while ((word = read_word()) !== ')')
  {
    undef(word, '( did not find a terminating )')
    if (word.match(number_regex))
    {
      list.push(parseFloat(word))
    }
    else if (word === 'nil')
    {
      list.push(null)
    }
    else if (word === '(')
    {
      list.push(build_list())
    }
    else if (word === '"')
    {
      w['"']()
      list.push(get())
    }
    else if (word === '`')
    {
      w['`']()
      get()()
      list.push(get())
    }
    else
    {
      list.push(word)
    }
  }
  return list
}

function trace_into_list (element, list)
{
  const code = compile_element(element)
  if (code)
  {
    list.push(() => { code(); console.log('trace:', element, ...stack) })
  }
}

function translate_case (str)
{
  let res = ''
  const len = str.length
  for (let i = 0; i < len; i++)
  {
    if (str[i] === '-')
    {
      if (i + 1 >= len)
      {
        error('- in dot notation at the end of a property', str)
      }
      res += str[++i].toUpperCase()
    }
    else
    {
      res += str[i]
    }
  }
  return res
}

function css (lists)
{
  let str = ''
  for (let list of lists)
  {
    const [element, ...properties] = list
    if (element === 'font-face')
    {
      if (properties[2])
      {
        str += '@font-face { font-family: ' + properties[0] + '; src: url("' + properties[1] + '") format("' + properties[2] + '")  } '
      }
      else
      {
        str += '@font-face { font-family: ' + properties[0] + '; src: url("' + properties[1] + '") } '
      }
      continue
    }
    
    str += element + ' { '

    const len = properties.length
    for (let i = 0; i < len; i += 2)
    {
      str += properties[i] + ': '
      const value = properties[i + 1]
      if (Array.isArray(value))
      {
        if (properties[i] === 'font-family')
        {
          str += value.join(', ')
        }
        else if (Array.isArray(value[0]))
        {
          str += value.map(x => x.join(' ')).join(', ')
        }
        else
        {
          str += value.join(' ')
        }
      }
      else
      {
        str += value
      }
      str += '; '
    }
    str += '} '
  }
  return str
}

function interpolate_list (list)
{
  const res = []
  const len = list.length
  for (let i = 0; i < len; i++)
  {
    const element = list[i]
    const type = typeof element
    if (type === 'string')
    {
      if (element === ',')
      {
        res.push(get())
      }
      else if (element.startsWith(','))
      {
        interpret_element(element.substr(1))
        res.push(get())
      }
      else
      {
        res.push(element)
      }
    }
    else if (Array.isArray(element))
    {
      res.push(interpolate_list(element))
    }
    else
    {
      res.push(element)
    }
  }
  return res
}

// wds

w['('] = () => { const list = build_list(); put(() => put([...list])) }

w[':'] = () =>
{
  const name = read_name(':')
  env.word[name] = env_block(make_env(env), ';')
}

w['wait'] = () => { make_fun = make_async_sub }
w['no-wait'] = () => { make_fun = make_sub }

w.s = () => { console.log([...stack]) }

w.block = () =>
{
  const e = env
  const code = block()
  put(() => { const old = env; env = make_env(e); code(); env = old })
}

w.lambda = () =>
{
  const e = env
  const code = env_block(e)
  put(() => put(() => { const old = env; env = make_env(e); code(); env = old }))
}

w.defun = () =>
{
  const e = env
  const name = read_name('defun')
  const code = env_block(e)
  env.word[name] = () => { const old = env; env = make_env(e); code(); env = old }
}
w.eval = () => { interpret_element(get()) }
w['eval-string'] = () => { interpret_string(get()) }
w.compile = () => { put(compile_element(get())) }
w['compile-string'] = () => { put(compile_string(get())) }

w.r = () => stack = []

w.declare = () =>
{
  const name = read_name('declare')
  if (name === '(')
  {
    for (let word of build_list())
    {
      const fun = () => { put(fun.value) }
      env.word[word] = fun
      fun.value = 0
    }
  }
  else
  {
    const fun = () => put(fun.value)
    fun.value = 0
    env.word[name] = fun
  }
}

w.bind = () =>
{
  const name = read_name('bind')
  if (name === '(')
  {
    const funs = []
    const names = build_list()
    const len = names.length
    for (let i = 0; i < len; i++)
    {
      const fun = () => put(funs[i].value)
      funs[i] = fun
      env.word[names[i]] = fun
    }
    put(() =>
    {
      const values = getn(len);
      for (let i = 0; i < len; i++)
      {
        funs[i].value = values[i]
      }
    })
  }
  else
  {
    const fun = () => put(fun.value)
    fun.value = 0
    put(() => { fun.value = get() })
    env.word[name] = fun
  }
}

w.if = () =>
{
  const test = block('then')
  let word
  const true_branch = []
  const false_branch = []
  let pointer = true_branch
  while ((word = read_word()) !== 'end')
  {
    if (word === 'else')
    {
      if (pointer === false_branch)
      {
        error('if found else twice')
      }
      pointer = false_branch
    }
    else
    {
      compile_into_list(word, pointer)
    }
  }
  const true_code = make_fun(true_branch)
  const false_code = make_fun(false_branch)
  put(() => { test(); if (get()) { true_code() } else { false_code() } })
}

w.else = () => { error('else found outside if or in if without then') }
w.end = () => { error('end found outside a block or in if without then') }
w.nop = () => {}
w.find = () => put(find(get()))

w.promise = () =>
{
  const e = make_env(env)
  let reject, resolve
  e.word.reject = () => reject(get())
  e.word.resolve = () => resolve(get())
  const code = env_block(e)
  put(() => put(new Promise((res, rej) => { reject = rej; resolve = res; code() })))
}

w.interval = () =>
{
  const time = read_word()
  undef(time, 'interval did not read a number for the interval time')
  if (time.match(number_regex))
  {
    const code = block()
    put(() => setInterval(code, parseFloat(time)))
  }
  else
  {
    error('interval did not read a valid number for the interval time')
  }
}

w.timeout = () =>
{
  const time = read_word()
  undef(time, 'timeout did not read a number for the timeout time')
  if (time.match(number_regex))
  {
    const code = block()
    put(() => setTimeout(code, parseFloat(time)))
  }
  else
  {
    error('timeout did not read a valid number for the timeout time')
  }
}

mutator('increment-by-one', (slot, property) => slot[property]++)
mutator('decrement-by-one', (slot, property) => slot[property]--)
mutator('increment', (slot, property) => slot[property] += get())
mutator('decrement', (slot, property) => slot[property] -= get())
mutator('set', (slot, property) => slot[property] = get())
mutator('get', (slot, property) => put(slot[property]))

w.drop = get
w['2drop'] = get2
w['3drop'] = get3
w['4drop'] = get4

w.dup = () => { const element = get(); put(element, element) }
w.swap = () => { const [one, two] = get2(); put(two, one) }
w['..'] = () => { const [one, two] = get2(); put(one + two) }
w['+'] = () => { const [one, two] = get2(); put(one + two) }
w['-'] = () => { const [one, two] = get2(); put(one - two) }
w['/'] = () => { const [one, two] = get2(); put(one / two) }
w['*'] = () => { const [one, two] = get2(); put(one * two) }
w['%'] = () => { const [one, two] = get2(); put(one % two) }

w['{'] = () => { const code = block('}'); put(() => put(code)) }

w.log = () => console.log(get())

w.module = () =>
{
  const name = read_name('module')
  const e = make_env(env)
  env_block(e)
  env.word[name] = () => put(e)
  env.word[name].immediate = 0
}

w.import = () =>
{
  const e = get()
  const word = read_name('import')
  if (word === '(')
  {
    for (let name of build_list())
    {
      env.word[name] = e.word[name]
    }
  }
  else
  {
    env.word[word] = e.word[word]
  }
}

w['import-all'] = () =>
{
  const e = get()
  for (let name of Object.keys(e.word))
  {
    env.word[name] = e.word[name]
  }
}

w.object = () =>
{
  const obj = {}
  const list = get()
  const len = list.length
  for (let i = 0; i < len; i += 2)
  {
    obj[list[i]] = list[i + 1]
  }
  put(obj)
}

w.obj = () =>
{
  const obj = {}
  const list = get()
  const len = list.length
  const values = getn(len)

  for (let i = 0; i < len; i++)
  {
    obj[list[i]] = values[i]
  }
  put(obj)
}

w.properties = () =>
{
  const [object, list] = get2()
  const res = []
  for (let property of list)
  {
    put(object[property])
  }
}

w['"'] = () =>
{
  let str = ''
  let chr
  while ((chr = source[pointer++]) !== '"')
  {
    undef(chr, '" did not find a terminating "')
    if (chr === '\\')
    {
      chr = source[pointer++]
      undef(chr, '" \\ at the end of a string')
      if (escape[chr])
      {
        str += escape[chr]
      }
      else
      {
        str += chr
      }
    }
    else
    {
      str += chr
    }
  }
  const string = () => put(str)
  put(string)
}

w['`'] = () =>
{
  let str = ''
  let chr
  while ((chr = source[pointer++]) !== '`')
  {
    undef(chr, '` did not find a terminating `')
    if (chr === '\\')
    {
      chr = source[pointer++]
      undef(chr, '` \\ at the end of a string')
      if (escape[chr])
      {
        str += escape[chr]
      }
      else
      {
        str += chr
      }
    }
    else
    {
      str += chr
    }
  }
  const alternative_string = () => put(str)
  put(alternative_string)
}

w['get-property'] = () =>
{
  const [object, property] = get2()
  put(object[property])
}

w['remove-characters'] = () =>
{
  const [str, list] = get2()
  let res = ''
  const set = new Set(list)
  for (let chr of str)
  {
    if (!set.has(chr))
    {
      res += chr
    }
  }
  put(res)
}

w.case = () =>
{
  let test, else_code
  const obj = {}
  while ((test = read_word()) !== 'end')
  {
    undef(test, 'case did not find a terminating end')
    if (test === '(')
    {
      test = build_list()
    }
    else if (test === '"' || test === '`')
    {
      w[test]()
      test = get()
    }
    const word = read_word()
    if (word === 'end')
    {
      error('end keyword in the place of code inside case')
    }
    let code
    if (word === '(')
    {
      code = compile_list(build_list())
    }
    else if (word === '{')
    {
      w['{']()
      code = get()
    }
    else
    {
      code = compile_element(word)
    }
    if (Array.isArray(test))
    {
      for (let t of test)
      {
        obj[t] = code
      }
    }
    else if (test === 'else')
    {
      else_code = code
    }
    else if (typeof test === 'function')
    {
      test()
      obj[get()] = code
    }
    else
    {
      obj[test] = code
    }
  }
  put(() =>
  {
    const value = get()
    if (obj[value])
    {
      obj[value]()
    }
    else if (else_code)
    {
      else_code()
    }
  })
}

w.random = () =>
{
  const element = get()
  const type = typeof element
  if (Array.isArray(element))
  {
    put(element[Math.floor(Math.random() * element.length)])
  }
  else if (type === 'object')
  {
    const keys = Object.keys(element)
    put(element[keys[Math.floor(Math.random() * keys.length)]])
  }
  else if (type === 'number')
  {
    put(Math.floor(Math.random() * element))
  }
  else
  {
    error('random expects a list, an object or a number', element)
  }
}

w.iterator = () =>
{
  put({list: get(), pointer: 0})
}
w['next-element'] = () =>
{
  const iterator = get()
  if (++iterator.pointer >= iterator.list.length)
  {
    iterator.pointer = 0
  }
  put(iterator.list[iterator.pointer])
}
w['previous-element'] = () =>
{
  const iterator = get()
  if (--iterator.pointer < 0)
  {
    iterator.pointer = iterator.list.length - 1
  }
  put(iterator.list[iterator.pointer])
}
w['random-element'] = () =>
{
  const iterator = get()
  iterator.pointer = Math.floor(Math.random() * iterator.list.length)
  put(iterator.list[iterator.pointer])
}

w.keys = () => put(Object.keys(get()))
w.values = () => put(Object.values(get()))
w.entries = () => put(Object.entries(get()))
w.flatten = () => put(...get())
w['random-key'] = () =>
{
  const keys = Object.keys(get())
  put(keys[Math.floor(Math.random() * keys.length)])
}
w.uppercase = () => put(get().toUpperCase())
w.lowercase = () => put(get().toLowerCase())
w.css = () => put(css(get()))
w.trace = () => compile_into_list = trace_into_list
w['no-trace'] = () => compile_into_list = compile_in_list
w.list = () => put(getn(get()))
w.fetch = () => { put(fetch(get())) }
w.console = () => put(console)
w['---'] = () =>
{
  let chr = source[pointer++]
  while (chr !== undefined && chr !== '\n')
  {
    chr = source[pointer++]
  }
}
w.iterate = () =>
{
  const [list, code] = get2()
  for (let element of list)
  {
    put(element)
    code()
  }
}

w['@'] = () => put(interpolate_list(get()))
immediate(0, ': wait no-wait defun trace no-trace module import import-all declare ---')
immediate(1, 'block lambda bind increment { ( " ` if promise interval timeout case')
init()
