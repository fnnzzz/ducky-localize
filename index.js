const fs = require('fs').promises
const { MongoClient, ServerApiVersion } = require('mongodb');

const { DB_PASSWORD, PLATFORM } = process.env

if (!DB_PASSWORD) {
    console.log('❗️ Please provide DB_PASSWORD env variable');
    process.exit(1)
}

if (PLATFORM !== 'js' && PLATFORM !== 'android' && PLATFORM !== 'ios') {
    console.log(`❗️ Please specify a target platform (PLATFORM=js|android|ios)`)
    process.exit(1)
}

const uri = `mongodb+srv://duckyapp:${DB_PASSWORD}@ducky-localization.aijpw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const db = await client.db(PLATFORM === "js" ? "web" : "app");
        const collections = await db.listCollections().toArray()

        if (PLATFORM === 'js') {
            await converterJs(db, collections)
        }

        if (PLATFORM === 'android') {
            await converterAndroid(db, collections)
        }

        if (PLATFORM === 'ios') {
            await converterIos(db, collections)
        }

        process.exit(0)
    }
    catch (e) {
        console.log(e)
    }
}

run()

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function removeId({ _id, ...rest } = {}) {
    return rest
}

function getTargetLangDoc(collectionName, docs, lang) {
    const targetDoc = docs.filter(doc => {
        if (!doc.lang) {
            console.error('🚩 Document should have a `lang` property\n', collectionName, ':', JSON.stringify(doc))
            process.exit(1)
        }
        return doc.lang === lang
    }).pop()

    if (!targetDoc) {
        console.error('🚩 Document is empty or doesn\'t have a second lang\n', collectionName, ':', JSON.stringify(docs))
        process.exit(1)
    }

    const { lang: _lang, ...rest } = targetDoc // exclude a lang property from the result
    return rest
}

function checkThatDiffLangDocumentsHaveSamePropsCount(doc1, doc2) {
    const countTheSame = Object.keys(doc1 ?? {}).length === Object.keys(doc2 ?? {}).length

    if (!countTheSame) {
        console.error('🚩 Document should have the same count of properties for different languages\n', JSON.stringify(doc1))
        process.exit(1)
    }
}

async function converterJs(db, collections) {
    return new Promise((resolve) => {
        // IF WE NEED TO STORE AN EACH COLLECTION IF A SEPARATE FILE
        // const _writeToDisk = async (lang, collectionName, content) => {
        //     const fileName = `./localization-artifacts/${collectionName}-${lang}.json`
        //     await fs.writeFile(fileName, content)
        //     console.log(`✅ Updated - ${fileName}`);
        // }

        const _writeToDisk = async (lang, content) => {
            const fileName = `./localization-artifacts/localization-${lang}.json`
            await fs.writeFile(fileName, content)
            console.log(`✅ Updated - ${fileName}`);
        }

        let counter = 0
        let enContent = []
        let ukContent = []

        collections.forEach(async (collection) => {
            const docs = await db.collection(collection.name).find({}).toArray()
            if (docs.length) {
                const en = getTargetLangDoc(collection.name, docs, 'en')
                const uk = getTargetLangDoc(collection.name, docs, 'ua')
                checkThatDiffLangDocumentsHaveSamePropsCount(en, uk)

                const getData = (doc) => Object.keys(doc).filter(key => key !== '_id').map(key => {
                    return { key: `${collection.name}_${key}`, value: doc[key] }
                })

                enContent.push(...getData(en))
                ukContent.push(...getData(uk))

                // IF WE NEED TO STORE AN EACH COLLECTION IF A SEPARATE FILE
                // _writeToDisk('en', collection.name, JSON.stringify(removeId(en), null, 2))
                // _writeToDisk('uk', collection.name, JSON.stringify(removeId(uk), null, 2))
                counter++
            } else {
                counter++
            }

            if (counter === collections.length) {
                const prepareContent = langDoc => JSON.stringify(langDoc.reduce((acc, { key, value }) => {
                    acc = { ...acc, [key]: value }
                    return acc
                }, {}), null, 2)

                await _writeToDisk('en', prepareContent(enContent))
                await _writeToDisk('uk', prepareContent(ukContent))

                console.log(`\n\n😈 Complete!`);
                resolve()
            }
        })
    })
}

async function converterAndroid(db, collections) {
    return new Promise((resolve) => {
        const _convertJsonToXML = (collectionName, data) => {
            return Object.keys(data).map(key => {
                return `<string name="${collectionName}_${key}">${data[key]}</string>`
            }).join('\n')
        }

        let counter = 0

        let enContent = []
        let ukContent = []

        collections.forEach(async (collection, index) => {
            const docs = await db.collection(collection.name).find({}).toArray()

            if (docs.length) {
                const en = getTargetLangDoc(collection.name, docs, 'en')
                const uk = getTargetLangDoc(collection.name, docs, 'ua')

                checkThatDiffLangDocumentsHaveSamePropsCount(en, uk)

                enContent.push(_convertJsonToXML(collection.name, removeId(en)))
                ukContent.push(_convertJsonToXML(collection.name, removeId(uk)))
                counter++
            } else {
                counter++
            }

            if (counter === collections.length) {
                const prefix = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n\n'
                const postfix = '\n\n</resources>'

                const enFileName = './localization-artifacts/localization-en.xml'
                const ukFileName = `./localization-artifacts/localization-uk.xml`

                await fs.writeFile(enFileName, [prefix, ...enContent, postfix].join('\n'))
                console.log(`✅ Updated - ${enFileName}`);
                await fs.writeFile(ukFileName, [prefix, ...ukContent, postfix].join('\n'))
                console.log(`✅ Updated - ${ukFileName}`);
                console.log(`\n\n😈 Complete!`);
                resolve()
            }
        })
    })
}

async function converterIos(db, collections) {
    return new Promise((resolve) => {
        const _convertJsonToIosFormat = (collectionName, data) => {
            return Object.keys(data).map(key => {
                return `"${collectionName}_${key}" = ${data[key]}`
            }).join('\n')
        }

        let counter = 0

        let enContent = []
        let ukContent = []

        collections.forEach(async (collection, index) => {
            const docs = await db.collection(collection.name).find({}).toArray()

            if (docs.length) {
                const en = getTargetLangDoc(collection.name, docs, 'en')
                const uk = getTargetLangDoc(collection.name, docs, 'ua')

                checkThatDiffLangDocumentsHaveSamePropsCount(en, uk)

                enContent.push(_convertJsonToIosFormat(collection.name, removeId(en)))
                ukContent.push(_convertJsonToIosFormat(collection.name, removeId(uk)))
                counter++
            } else {
                counter++
            }

            if (counter === collections.length) {
                const prefix = `/*\n\tLocalizable.strings\n\tDucky\n\tCreated by https://hub.docker.com/r/fnnzzz/ducky-localize\n\ton ${new Date().toJSON()}\n*/\n\n`

                const enFileName = './localization-artifacts/Localizable_EN.strings'
                const ukFileName = `./localization-artifacts/Localizable_UK.strings`

                await fs.writeFile(enFileName, [prefix, ...enContent].join('\n'))
                console.log(`✅ Updated - ${enFileName}`);
                await fs.writeFile(ukFileName, [prefix, ...ukContent].join('\n'))
                console.log(`✅ Updated - ${ukFileName}`);
                console.log(`\n\n😈 Complete!`);
                resolve()
            }
        })
    })
}