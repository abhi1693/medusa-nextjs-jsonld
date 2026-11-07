import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProductJsonLd as product, buildHomeJsonLd as home, buildListingJsonLd as listing, buildBreadcrumbJsonLd as crumbs, buildPageJsonLd as page, stringifyJsonLd } from '../dist/index.js'
import { JsonLd } from '../dist/react.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const config = { baseUrl: 'https://store.example' }
const options = { url: '/gb/products/shirt' }
const priced = (extra = {}) => ({ id: 'v1', calculated_price: { calculated_amount: 12.5, currency_code: 'gbp' }, ...extra })
const build = (variant) => product({ title: 'Shirt', variants: [variant] }, config, options)

test('Medusa v2 prices remain major units, including zero; no price-list inference', () => {
  assert.equal(build(priced()).offers[0].price, 12.5)
  assert.equal(build(priced()).offers[0].priceCurrency, 'GBP')
  assert.equal(build(priced({calculated_price: {calculated_amount: 0, currency_code: 'jpy'}})).offers[0].price, 0)
  for (const amount of [NaN, Infinity, -1, '12', null, undefined]) {
    assert.equal(build(priced({calculated_price: {calculated_amount: amount, currency_code: 'gbp'}})).offers, undefined)
  }
  for (const currency of ['', 'euro', undefined, 123]) {
    assert.equal(build(priced({calculated_price: {calculated_amount: 1, currency_code: currency}})).offers, undefined)
  }
  assert.equal(build({prices: [{amount: 100, currency_code: 'usd'}]}).offers, undefined)
})

test('availability only uses known inventory state', () => {
  const cases = [
    [{manage_inventory: false}, 'InStock'],
    [{manage_inventory: true, inventory_quantity: 1}, 'InStock'],
    [{manage_inventory: true, inventory_quantity: 0, allow_backorder: true}, 'BackOrder'],
    [{manage_inventory: true, inventory_quantity: -1, allow_backorder: false}, 'OutOfStock'],
    [{manage_inventory: true, inventory_quantity: 0}, undefined],
    [{manage_inventory: true, allow_backorder: true}, undefined],
    [{manage_inventory: true, inventory_quantity: NaN}, undefined],
    [{inventory_quantity: 10}, undefined],
    [{}, undefined],
  ]
  for (const [fields, expected] of cases) assert.equal(build(priced(fields)).offers[0].availability, expected && `https://schema.org/${expected}`)
})

test('fallback defaults, product inference, metadata, then overrides; only allowlisted fields', () => {
  const input = {title: 'Actual', metadata: {jsonld: {brand: 'Metadata', name: 'Editorial', offers: {price: 0}, aggregateRating: {}, '@type': 'Fake'}}}
  const conf = {...config, productDefaults: {name: 'Fallback', brand: 'Default'}}
  const data = product(input, conf, {...options, overrides: {brand: 'Override'}})
  assert.equal(data.name, 'Editorial')
  assert.deepEqual(data.brand, {'@type': 'Brand', name: 'Override'})
  assert.equal(data['@type'], 'Product')
  assert.equal(data.aggregateRating, undefined)
  assert.equal(data.offers, undefined)
  assert.equal(product({title: 'Actual'}, conf, options).name, 'Actual')
  assert.equal(product({}, conf, options).name, 'Fallback')
  assert.equal(product({metadata: {jsonld: 'bad'}}, config, options).name, undefined)
})

test('localized canonical and explicit variant URLs; duplicate images deduplicated', () => {
  const data = product({title: 'Shirt', thumbnail: '/shirt.png', images: [{url: '/shirt.png'}, {url: 'https://cdn.example/back.png'}], variants: [priced({sku: 'BLUE'}), priced({id: 'v2'})]}, config, {...options, variantUrls: {v1: '/gb/products/shirt?v_id=v1'}})
  assert.equal(data.url, 'https://store.example/gb/products/shirt')
  assert.equal(data['@id'], data.url + '#product')
  assert.deepEqual(data.image, ['https://store.example/shirt.png', 'https://cdn.example/back.png'])
  assert.equal(data.offers[0].url, data.url + '?v_id=v1')
  assert.equal(data.offers[1].url, data.url)
  assert.equal(data.offers[0].sku, 'BLUE')
})

test('URLs reject credentials, unsafe schemes, and malformed inputs', () => {
  for (const url of ['', 'javascript:alert(1)', 'data:text/plain,x', 'https://user:pass@example.com', 'http://[bad']) {
    assert.throws(() => product({}, config, {url}), TypeError)
    assert.throws(() => home({baseUrl: url}), TypeError)
  }
  assert.equal(product({thumbnail: 'javascript:bad'}, config, options).image, undefined)
  assert.deepEqual(product({images: [{url: 'javascript:bad'}, {url: '/valid.png'}]}, config, options).image, ['https://store.example/valid.png'])
  assert.throws(() => crumbs([{name: 'relative', url: '/relative'}]), TypeError)
})

test('homepage organization is opt-in; graph references publisher consistently', () => {
  const minimal = home(config, {url: '/de', name: 'Store'})
  assert.equal(minimal['@type'], 'WebSite')
  assert.equal(minimal.publisher, undefined)
  const data = home({...config, organization: {name: 'Store', logo: '/logo.png', sameAs: ['https://social.example/store']}}, {url: '/de', inLanguage: 'de'})
  assert.equal(data['@graph'].length, 2)
  assert.equal(data['@graph'][0].publisher['@id'], data['@graph'][1]['@id'])
  assert.equal(data['@graph'][1].logo, 'https://store.example/logo.png')
})

test('listing reflects visible subset/order, URLs and optional breadcrumbs', () => {
  const breadcrumb = [{name: 'Home', url: 'https://store.example/gb'}]
  const data = listing({name: 'Shirts', products: [{name: 'Second', url: '/gb/products/2'}, {name: 'First', url: '/gb/products/1'}], breadcrumbs: breadcrumb}, config, {url: '/gb/collections/shirts?page=2'})
  assert.equal(data['@type'], 'CollectionPage')
  assert.equal(data.mainEntity.numberOfItems, 2)
  assert.equal(data.mainEntity.itemListElement[0].position, 1)
  assert.equal(data.mainEntity.itemListElement[0].name, 'Second')
  assert.equal(data.breadcrumb.itemListElement[0].item, breadcrumb[0].url)
  assert.equal(listing({name: 'Empty', products: []}, config, {url: '/empty'}).mainEntity.numberOfItems, 0)
})

test('breadcrumbs and informational pages contain real supplied values', () => {
  const items = [{name: 'Home', url: 'https://store.example/'}, {name: 'About', url: 'https://store.example/about'}]
  assert.deepEqual(crumbs(items).itemListElement.map(x => x.position), [1, 2])
  assert.equal(page({name: 'About', url: '/about', type: 'AboutPage', breadcrumbs: items}, config)['@type'], 'AboutPage')
  assert.throws(() => page({name: 'Fake', url: '/', type: 'FAQPage'}, config), TypeError)
  assert.equal(product({title: 'Shirt'}, config, {...options, breadcrumbs: items})['@graph'].length, 2)
})

test('serializer and SSR cannot break out of script; nonce supported; null renders nothing', () => {
  const attack = '</script><script>alert("x")</script>&\u2028\u2029'
  const data = product({title: attack}, config, options)
  const safe = stringifyJsonLd(data)
  assert.equal(JSON.parse(safe).name, attack)
  assert.doesNotMatch(safe, /[<>&\u2028\u2029]/)
  const html = renderToStaticMarkup(createElement(JsonLd, {data, id: 'product-jsonld', nonce: 'nonce-value'}))
  assert.equal((html.match(/<script/g) || []).length, 1)
  assert.equal((html.match(/<\/script>/g) || []).length, 1)
  assert.match(html, /type="application\/ld\+json"/)
  assert.match(html, /nonce="nonce-value"/)
  assert.equal(JSON.parse(html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>'))).name, attack)
  assert.equal(renderToStaticMarkup(createElement(JsonLd, {data: null})), '')
})
