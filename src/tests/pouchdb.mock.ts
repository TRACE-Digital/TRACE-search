import PouchDB from 'pouchdb';
import PouchDBMemory from 'pouchdb-adapter-memory';

PouchDB.plugin(PouchDBMemory);
