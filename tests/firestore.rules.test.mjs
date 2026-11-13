import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'

const projectId = 'demo-comissgest'
let testEnvironment

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  })
})

beforeEach(async () => {
  await testEnvironment.clearFirestore()
})

after(async () => {
  await testEnvironment.cleanup()
})

function makeOwnerBootstrap(db, { uid, companyId, ownerUid = uid }) {
  const timestamp = serverTimestamp()
  const batch = writeBatch(db)
  batch.set(doc(db, 'companies', companyId), {
    name: 'Empresa de teste',
    ownerUid,
    cnpj: null,
    brandColors: { primary: '#187f63' },
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  batch.set(doc(db, 'companies', companyId, 'members', uid), {
    uid,
    companyId,
    role: 'owner',
    createdAt: timestamp,
  })
  batch.set(doc(db, 'users', uid, 'memberships', companyId), {
    companyId,
    companyName: 'Empresa de teste',
    cnpj: null,
    brandColors: { primary: '#187f63' },
    role: 'owner',
    createdAt: timestamp,
  })
  return batch.commit()
}

async function seedCompany(uid, companyId) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    const timestamp = serverTimestamp()
    await setDoc(doc(db, 'companies', companyId), {
      name: 'Empresa de teste',
      ownerUid: uid,
      cnpj: null,
      brandColors: { primary: '#187f63' },
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await setDoc(doc(db, 'companies', companyId, 'members', uid), {
      uid,
      companyId,
      role: 'owner',
      createdAt: timestamp,
    })
    await setDoc(doc(db, 'users', uid, 'memberships', companyId), {
      companyId,
      companyName: 'Empresa de teste',
      cnpj: null,
      brandColors: { primary: '#187f63' },
      role: 'owner',
      createdAt: timestamp,
    })
  })
}

test('permite criar empresa, proprietário e espelho de associação atomicamente', async () => {
  const db = testEnvironment.authenticatedContext('alice').firestore()
  await assertSucceeds(makeOwnerBootstrap(db, { uid: 'alice', companyId: 'company-alice' }))

  await assertSucceeds(getDoc(doc(db, 'companies', 'company-alice')))
  await assertSucceeds(getDoc(doc(db, 'companies', 'company-alice', 'members', 'alice')))
  await assertSucceeds(getDoc(doc(db, 'users', 'alice', 'memberships', 'company-alice')))
})

test('nega a criação de uma empresa declarando outro usuário como proprietário', async () => {
  const db = testEnvironment.authenticatedContext('alice').firestore()
  await assertFails(makeOwnerBootstrap(db, {
    uid: 'alice',
    ownerUid: 'bob',
    companyId: 'company-bob',
  }))
})

test('nega que um proprietário crie uma associação para outro usuário', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  const batch = writeBatch(db)
  batch.set(doc(db, 'companies', companyId, 'members', 'bob'), {
    uid: 'bob', companyId, role: 'member', createdAt: serverTimestamp(),
  })
  batch.set(doc(db, 'users', 'bob', 'memberships', companyId), {
    companyId, companyName: 'Empresa de teste', cnpj: null,
    role: 'member', createdAt: serverTimestamp(),
  })
  await assertFails(batch.commit())
})

test('nega leitura da empresa a um usuário sem associação', async () => {
  await seedCompany('alice', 'company-alice')
  const db = testEnvironment.authenticatedContext('bob').firestore()
  await assertFails(getDoc(doc(db, 'companies', 'company-alice')))
})

test('o proprietário lê somente as próprias vendas', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'companies', companyId, 'sales', 'sale-alice'), { userId: 'alice' })
    await setDoc(doc(db, 'companies', companyId, 'sales', 'sale-bob'), { userId: 'bob' })
  })

  const db = testEnvironment.authenticatedContext('alice').firestore()
  await assertSucceeds(getDoc(doc(db, 'companies', companyId, 'sales', 'sale-alice')))
  await assertFails(getDoc(doc(db, 'companies', companyId, 'sales', 'sale-bob')))
})

test('nega que o cliente altere o papel do proprietário', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  await assertFails(setDoc(
    doc(db, 'companies', companyId, 'members', 'alice'),
    { uid: 'alice', companyId, role: 'member', createdAt: serverTimestamp() },
  ))
})

test('permite ao proprietário editar dados e identidade visual em lote', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  const batch = writeBatch(db)
  const brandColors = { primary: '#2563eb' }
  batch.update(doc(db, 'companies', companyId), {
    name: 'Comércio Azul',
    cnpj: '12345678000199',
    brandColors,
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', 'alice', 'memberships', companyId), {
    companyName: 'Comércio Azul',
    cnpj: '12345678000199',
    brandColors,
  })

  await assertSucceeds(batch.commit())
  const company = await getDoc(doc(db, 'companies', companyId))
  assert.equal(company.data().name, 'Comércio Azul')
  assert.equal(company.data().brandColors.primary, '#2563eb')
})

test('nega atualização com cor inválida ou tentativa de alterar o proprietário', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  const invalidColor = writeBatch(db)
  invalidColor.update(doc(db, 'companies', companyId), {
    brandColors: { primary: 'verde' }, updatedAt: serverTimestamp(),
  })
  invalidColor.update(doc(db, 'users', 'alice', 'memberships', companyId), {
    brandColors: { primary: 'verde' },
  })
  await assertFails(invalidColor.commit())

  await assertFails(updateDoc(doc(db, 'companies', companyId), { ownerUid: 'bob' }))
  await assertFails(updateDoc(doc(db, 'companies', companyId), { internalRole: 'admin' }))
})

test('nega que um usuário sem papel de proprietário altere a empresa', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('bob').firestore()
  await assertFails(updateDoc(doc(db, 'companies', companyId), {
    name: 'Alteração não autorizada',
    updatedAt: serverTimestamp(),
  }))
})

test('permite registrar venda própria com comissão calculada e valores inteiros', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  await assertSucceeds(setDoc(doc(db, 'companies', companyId, 'sales', 'sale-1'), {
    userId: 'alice',
    amountCents: 15075,
    commissionRateBps: 1000,
    commissionCents: 1508,
    soldAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }))
})

test('permite a data de venda escolhida no passado e nega datas futuras', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()

  await assertSucceeds(setDoc(doc(db, 'companies', companyId, 'sales', 'backdated-sale'), {
    userId: 'alice', amountCents: 10000, commissionRateBps: 1000,
    commissionCents: 1000, soldAt: Timestamp.fromDate(new Date('2025-05-20T15:00:00Z')),
    createdAt: serverTimestamp(),
  }))

  await assertFails(setDoc(doc(db, 'companies', companyId, 'sales', 'future-sale'), {
    userId: 'alice', amountCents: 10000, commissionRateBps: 1000,
    commissionCents: 1000, soldAt: Timestamp.fromDate(new Date('2099-05-20T15:00:00Z')),
    createdAt: serverTimestamp(),
  }))
})

test('nega comissão manipulada, valor fora do formato ou venda em nome de outro usuário', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()

  await assertFails(setDoc(doc(db, 'companies', companyId, 'sales', 'wrong-commission'), {
    userId: 'alice', amountCents: 10000, commissionRateBps: 1000,
    commissionCents: 5000, soldAt: serverTimestamp(), createdAt: serverTimestamp(),
  }))
  await assertFails(setDoc(doc(db, 'companies', companyId, 'sales', 'wrong-cents'), {
    userId: 'alice', amountCents: 100.5, commissionRateBps: 1000,
    commissionCents: 101, soldAt: serverTimestamp(), createdAt: serverTimestamp(),
  }))
  await assertFails(setDoc(doc(db, 'companies', companyId, 'sales', 'other-user'), {
    userId: 'bob', amountCents: 10000, commissionRateBps: 1000,
    commissionCents: 1000, soldAt: serverTimestamp(), createdAt: serverTimestamp(),
  }))
})

test('a consulta individual de vendas funciona e não revela vendas de terceiros', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'companies', companyId, 'sales', 'sale-alice'), {
      userId: 'alice', amountCents: 10000, commissionRateBps: 1000,
      commissionCents: 1000, soldAt: serverTimestamp(), createdAt: serverTimestamp(),
    })
    await setDoc(doc(db, 'companies', companyId, 'sales', 'sale-bob'), {
      userId: 'bob', amountCents: 20000, commissionRateBps: 1000,
      commissionCents: 2000, soldAt: serverTimestamp(), createdAt: serverTimestamp(),
    })
  })

  const db = testEnvironment.authenticatedContext('alice').firestore()
  const ownSales = query(
    collection(db, 'companies', companyId, 'sales'),
    where('userId', '==', 'alice'),
    orderBy('soldAt', 'desc'),
  )
  const result = await getDocs(ownSales)
  assert.equal(result.size, 1)
  assert.equal(result.docs[0].data().userId, 'alice')
})

test('permite editar os dados da própria venda e preserva a autoria e criação', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'companies', companyId, 'sales', 'sale-1'), {
      userId: 'alice', amountCents: 10000, commissionRateBps: 1000,
      commissionCents: 1000, soldAt: Timestamp.fromDate(new Date('2025-05-20T15:00:00Z')), createdAt: Timestamp.fromDate(new Date('2025-05-20T15:00:00Z')),
    })
  })
  const db = testEnvironment.authenticatedContext('alice').firestore()
  await assertSucceeds(updateDoc(doc(db, 'companies', companyId, 'sales', 'sale-1'), {
    soldAt: Timestamp.fromDate(new Date('2025-06-20T15:00:00Z')),
    amountCents: 20000,
    commissionRateBps: 1500,
    commissionCents: 3000,
  }))
  await assertFails(updateDoc(doc(db, 'companies', companyId, 'sales', 'sale-1'), { userId: 'bob' }))
  await assertFails(updateDoc(doc(db, 'companies', companyId, 'sales', 'sale-1'), { createdAt: serverTimestamp() }))
  await assertFails(updateDoc(doc(db, 'companies', companyId, 'sales', 'sale-1'), {
    soldAt: Timestamp.fromDate(new Date('2099-05-20T15:00:00Z')),
  }))
})

test('permite excluir somente a própria venda', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'companies', companyId, 'sales', 'sale-alice'), { userId: 'alice' })
    await setDoc(doc(db, 'companies', companyId, 'sales', 'sale-bob'), { userId: 'bob' })
  })
  const db = testEnvironment.authenticatedContext('alice').firestore()
  await assertSucceeds(deleteDoc(doc(db, 'companies', companyId, 'sales', 'sale-alice')))
  await assertFails(deleteDoc(doc(db, 'companies', companyId, 'sales', 'sale-bob')))
})
