#!/usr/bin/env node

/**
 * Carga datos semilla en el emulador de Firestore.
 * Requiere: FIRESTORE_EMULATOR_HOST definido (lo setea el Makefile).
 */

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const data = require("./firestore.json");

process.env.FIRESTORE_EMULATOR_HOST ??= "localhost:8080";

initializeApp({ projectId: "demo-carpil" });
const db = getFirestore();

async function seed() {
  for (const [collection, docs] of Object.entries(data)) {
    for (const doc of docs) {
      const { __id, ...fields } = doc;
      await db.collection(collection).doc(__id).set(fields);
      console.log(`  ✓ ${collection}/${__id}`);
    }
  }
}

seed()
  .then(() => {
    console.log("Seed completo.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error en seed:", err);
    process.exit(1);
  });
