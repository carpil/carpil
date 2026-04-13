#!/usr/bin/env node

/**
 * Carga datos semilla en el emulador de Firebase (Auth + Firestore).
 * Requiere: FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST definidos.
 */

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const data = require("./firestore.json");

process.env.FIRESTORE_EMULATOR_HOST ??= "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "localhost:9099";

initializeApp({ projectId: "demo-carpil" });

const db = getFirestore();
const auth = getAuth();

const AUTH_USERS = [
  {
    uid: "seed_alejandro_01",
    email: "alejandro@carpil.app",
    password: "test1234",
    displayName: "Alejandro Carpil",
  },
  {
    uid: "seed_melissa_01",
    email: "melissa@carpil.app",
    password: "test1234",
    displayName: "Melissa Carpil",
  },
];

async function seedAuth() {
  for (const user of AUTH_USERS) {
    try {
      await auth.createUser(user);
      console.log(`  ✓ auth/${user.email}`);
    } catch (err) {
      if (err.code === "auth/uid-already-exists" || err.code === "auth/email-already-exists") {
        console.log(`  ~ auth/${user.email} (ya existe, omitido)`);
      } else {
        throw err;
      }
    }
  }
}

async function seedFirestore() {
  for (const [collection, docs] of Object.entries(data)) {
    for (const doc of docs) {
      const { __id, ...fields } = doc;

      // Convertir strings ISO a Timestamps de Firestore
      const converted = convertDates(fields);

      await db.collection(collection).doc(__id).set(converted);
      console.log(`  ✓ ${collection}/${__id}`);
    }
  }
}

function convertDates(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string" && /^\d{4}-\d{2}-\d{2}T/.test(obj)) {
    return Timestamp.fromDate(new Date(obj));
  }
  if (Array.isArray(obj)) return obj.map(convertDates);
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertDates(v)])
    );
  }
  return obj;
}

async function seed() {
  console.log("\n→ Seeding Firebase Auth...");
  await seedAuth();

  console.log("\n→ Seeding Firestore...");
  await seedFirestore();
}

seed()
  .then(() => {
    console.log("\n✓ Seed completo.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error en seed:", err);
    process.exit(1);
  });
