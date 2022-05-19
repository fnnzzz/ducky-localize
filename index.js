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

async function converterJs(db, collections) {
    return new Promise((resolve) => {
        const _writeToDisk = async (lang, collectionName, content) => {
            const fileName = `./localization-artifacts/${collectionName}-${lang}.json`
            await fs.writeFile(fileName, content)
            console.log(`✅ Updated - ${fileName}`);
        }

        let counter = 0

        collections.forEach(async (collection) => {
            const docs = await db.collection(collection.name).find({}).toArray()
            if (docs.length) {
                const [en, uk] = docs
                _writeToDisk('en', collection.name, JSON.stringify(removeId(en), null, 2))
                _writeToDisk('uk', collection.name, JSON.stringify(removeId(uk), null, 2))
                counter++
            } else {
                counter++
            }

            if (counter === collections.length) {
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
                const [en, uk] = docs
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