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
const goalPromptSettings = {
  askForMonthlyGoalIfMissing: true,
  monthlyGoalReminderMessage: 'Você ainda não cadastrou uma meta para este mês. Que tal definir seu objetivo e acompanhar seu progresso?',
}
const defaultStatuses = [
  { statusId: 'created', name: 'Criado', color: '#187f63', sortOrder: 0, isFinalizedIndicator: false },
  { statusId: 'in-fabrication', name: 'Em fabricação', color: '#3877c8', sortOrder: 1, isFinalizedIndicator: false },
  { statusId: 'awaiting-delivery', name: 'Aguardando entrega', color: '#b7791f', sortOrder: 2, isFinalizedIndicator: false },
  { statusId: 'finished', name: 'Finalizado', color: '#39834a', sortOrder: 3, isFinalizedIndicator: true },
]

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

async function makeOwnerBootstrap(db, { uid, companyId, ownerUid = uid }) {
  const timestamp = serverTimestamp()
  const batch = writeBatch(db)
  batch.set(doc(db, 'companies', companyId), {
    name: 'Empresa de teste',
    ownerUid,
    cnpj: null,
    brandColors: { primary: '#187f63', darkPrimary: '#60a5fa' },
    ...goalPromptSettings,
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
    brandColors: { primary: '#187f63', darkPrimary: '#60a5fa' },
    ...goalPromptSettings,
    role: 'owner',
    createdAt: timestamp,
  })
  await batch.commit()

  const statusBatch = writeBatch(db)
  const statusTimestamp = serverTimestamp()
  for (const { statusId, ...status } of defaultStatuses) {
    statusBatch.set(doc(db, 'companies', companyId, 'saleStatuses', statusId), {
      ...status,
      active: true,
      usageCount: 0,
      lastUsageChangeSaleId: null,
      createdAt: statusTimestamp,
      updatedAt: statusTimestamp,
      createdBy: uid,
      updatedBy: uid,
    })
  }
  statusBatch.set(doc(db, 'companies', companyId, 'saleStatusSettings', 'defaults'), {
    defaultsInitialized: true, createdAt: statusTimestamp, createdBy: uid,
  })
  return statusBatch.commit()
}

async function seedCompany(uid, companyId) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    const timestamp = serverTimestamp()
    await setDoc(doc(db, 'companies', companyId), {
      name: 'Empresa de teste',
      ownerUid: uid,
      cnpj: null,
      brandColors: { primary: '#187f63', darkPrimary: '#60a5fa' },
      ...goalPromptSettings,
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
      brandColors: { primary: '#187f63', darkPrimary: '#60a5fa' },
      ...goalPromptSettings,
      role: 'owner',
      createdAt: timestamp,
    })
    for (const { statusId, ...status } of defaultStatuses) {
      await setDoc(doc(db, 'companies', companyId, 'saleStatuses', statusId), {
        ...status,
        active: true,
        usageCount: 0,
        lastUsageChangeSaleId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: uid,
        updatedBy: uid,
      })
    }
    await setDoc(doc(db, 'companies', companyId, 'saleStatusSettings', 'defaults'), {
      defaultsInitialized: true, createdAt: timestamp, createdBy: uid,
    })
  })
}

function transactionSaleData(userId, soldAt = serverTimestamp(), statusId = undefined) {
  return {
    userId,
    soldAt,
    createdAt: serverTimestamp(),
    ...(statusId ? { statusId } : {}),
    items: [{ itemId: 'item-1', amountCents: 10000, commissionRateBps: 1000, commissionCents: 1000, quantity: 1 }],
  }
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
      brandColors: { primary: '#187f63', darkPrimary: '#60a5fa' },
    ...goalPromptSettings,
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
  const brandColors = { primary: '#2563eb', darkPrimary: '#38bdf8' }
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
  assert.equal(company.data().brandColors.darkPrimary, '#38bdf8')
})

test('permite ao proprietário atualizar a configuração do aviso de meta em lote', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  const batch = writeBatch(db)
  const message = 'Defina sua meta para este mês e acompanhe seu progresso.'
  batch.update(doc(db, 'companies', companyId), {
    askForMonthlyGoalIfMissing: false,
    monthlyGoalReminderMessage: message,
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', 'alice', 'memberships', companyId), {
    askForMonthlyGoalIfMissing: false,
    monthlyGoalReminderMessage: message,
  })

  await assertSucceeds(batch.commit())
})

test('nega configuração de aviso de meta divergente entre empresa e associação', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  const batch = writeBatch(db)
  batch.update(doc(db, 'companies', companyId), {
    askForMonthlyGoalIfMissing: false,
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', 'alice', 'memberships', companyId), {
    askForMonthlyGoalIfMissing: true,
  })

  await assertFails(batch.commit())
})

test('nega atualização com cor inválida ou tentativa de alterar o proprietário', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  const invalidColor = writeBatch(db)
  invalidColor.update(doc(db, 'companies', companyId), {
    brandColors: { primary: '#187f63', darkPrimary: 'azul' }, updatedAt: serverTimestamp(),
  })
  invalidColor.update(doc(db, 'users', 'alice', 'memberships', companyId), {
    brandColors: { primary: '#187f63', darkPrimary: 'azul' },
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

test('permite registrar uma venda própria com itens embutidos e atualizar a contagem do status atomicamente', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  const saleId = 'sale-1'
  const batch = writeBatch(db)
  batch.set(doc(db, 'companies', companyId, 'sales', saleId), transactionSaleData('alice', serverTimestamp(), 'created'))
  batch.update(doc(db, 'companies', companyId, 'saleStatuses', 'created'), {
    usageCount: 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  await assertSucceeds(batch.commit())
})

test('permite mover uma venda entre status ativos com contadores atômicos e nega status inativo como destino', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  const saleId = 'sale-1'
  const saleRef = doc(db, 'companies', companyId, 'sales', saleId)
  const createdStatusRef = doc(db, 'companies', companyId, 'saleStatuses', 'created')
  const fabricationStatusRef = doc(db, 'companies', companyId, 'saleStatuses', 'in-fabrication')
  const inactiveStatusRef = doc(db, 'companies', companyId, 'saleStatuses', 'awaiting-delivery')
  const createBatch = writeBatch(db)
  createBatch.set(saleRef, transactionSaleData('alice', serverTimestamp(), 'created'))
  createBatch.update(createdStatusRef, {
    usageCount: 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  await assertSucceeds(createBatch.commit())

  const moveBatch = writeBatch(db)
  moveBatch.update(saleRef, { statusId: 'in-fabrication' })
  moveBatch.update(createdStatusRef, {
    usageCount: 0, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  moveBatch.update(fabricationStatusRef, {
    usageCount: 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  await assertSucceeds(moveBatch.commit())

  await assertSucceeds(updateDoc(inactiveStatusRef, {
    active: false, updatedAt: serverTimestamp(), updatedBy: 'alice',
  }))
  const inactiveMoveBatch = writeBatch(db)
  inactiveMoveBatch.update(saleRef, { statusId: 'awaiting-delivery' })
  inactiveMoveBatch.update(fabricationStatusRef, {
    usageCount: 0, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  inactiveMoveBatch.update(inactiveStatusRef, {
    usageCount: 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  await assertFails(inactiveMoveBatch.commit())
})

test('permite converter uma venda legada ao mover e preserva seus valores e observação', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const saleId = 'legacy-sale'
  const soldAt = Timestamp.fromDate(new Date('2025-05-20T15:00:00Z'))
  const createdAt = Timestamp.fromDate(new Date('2025-05-20T15:01:00Z'))
  const legacyNotes = 'Observação antiga'
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'companies', companyId, 'sales', saleId), {
      userId: 'alice',
      amountCents: 10000,
      commissionRateBps: 1000,
      commissionCents: 1000,
      soldAt,
      createdAt,
      notes: legacyNotes,
    })
  })

  const db = testEnvironment.authenticatedContext('alice').firestore()
  const saleRef = doc(db, 'companies', companyId, 'sales', saleId)
  const statusRef = doc(db, 'companies', companyId, 'saleStatuses', 'in-fabrication')
  const conversionBatch = writeBatch(db)
  conversionBatch.set(saleRef, {
    userId: 'alice',
    soldAt,
    createdAt,
    statusId: 'in-fabrication',
    items: [{
      itemId: `${saleId}-legacy-item`,
      amountCents: 10000,
      commissionRateBps: 1000,
      commissionCents: 1000,
      quantity: 1,
      notes: legacyNotes,
    }],
  })
  conversionBatch.update(statusRef, {
    usageCount: 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  await assertSucceeds(conversionBatch.commit())

  const convertedSale = (await getDoc(saleRef)).data()
  assert.equal(convertedSale.statusId, 'in-fabrication')
  assert.equal(convertedSale.soldAt.toMillis(), soldAt.toMillis())
  assert.equal(convertedSale.createdAt.toMillis(), createdAt.toMillis())
  assert.deepEqual(convertedSale.items[0], {
    itemId: `${saleId}-legacy-item`,
    amountCents: 10000,
    commissionRateBps: 1000,
    commissionCents: 1000,
    quantity: 1,
    notes: legacyNotes,
  })
  assert.equal(convertedSale.amountCents, undefined)
})

test('status de venda é legível e administrável por qualquer membro da empresa', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'companies', companyId, 'members', 'bob'), {
      uid: 'bob', companyId, role: 'member', createdAt: Timestamp.now(),
    })
  })
  const ownerDb = testEnvironment.authenticatedContext('alice').firestore()
  const memberDb = testEnvironment.authenticatedContext('bob').firestore()
  const newStatus = {
    name: 'Em separação', color: '#7856a8', sortOrder: 4, active: true, isFinalizedIndicator: false,
    usageCount: 0, lastUsageChangeSaleId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    createdBy: 'alice', updatedBy: 'alice',
  }
  await assertSucceeds(getDocs(collection(memberDb, 'companies', companyId, 'saleStatuses')))
  await assertSucceeds(setDoc(doc(ownerDb, 'companies', companyId, 'saleStatuses', 'packing'), newStatus))
  await assertFails(setDoc(doc(ownerDb, 'companies', companyId, 'saleStatuses', 'invalid-color'), {
    ...newStatus, color: 'blue',
  }))
  await assertSucceeds(setDoc(doc(memberDb, 'companies', companyId, 'saleStatuses', 'quality-check'), {
    ...newStatus, name: 'Conferência', createdBy: 'bob', updatedBy: 'bob',
  }))
  await assertSucceeds(updateDoc(doc(memberDb, 'companies', companyId, 'saleStatuses', 'quality-check'), {
    name: 'Conferido', updatedAt: serverTimestamp(), updatedBy: 'bob',
  }))
  await assertSucceeds(deleteDoc(doc(memberDb, 'companies', companyId, 'saleStatuses', 'quality-check')))
  await assertSucceeds(deleteDoc(doc(ownerDb, 'companies', companyId, 'saleStatuses', 'created')))
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), 'companies', companyId, 'saleStatuses', 'finished'), { usageCount: 1 })
  })
  await assertFails(deleteDoc(doc(memberDb, 'companies', companyId, 'saleStatuses', 'finished')))
})

test('conta status associados a itens e bloqueia a exclusão até remover as referências', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()
  const saleId = 'sale-with-item-status'
  const saleRef = doc(db, 'companies', companyId, 'sales', saleId)
  const createdStatusRef = doc(db, 'companies', companyId, 'saleStatuses', 'created')
  const fabricationStatusRef = doc(db, 'companies', companyId, 'saleStatuses', 'in-fabrication')
  const finishedStatusRef = doc(db, 'companies', companyId, 'saleStatuses', 'finished')
  const sale = {
    ...transactionSaleData('alice', serverTimestamp(), 'created'),
    itemStatusUsage: { 'in-fabrication': 2 },
    items: [
      { itemId: 'item-1', amountCents: 5000, commissionRateBps: 1000, commissionCents: 500, quantity: 1, statusId: 'in-fabrication' },
      { itemId: 'item-2', amountCents: 5000, commissionRateBps: 1000, commissionCents: 500, quantity: 1, statusId: 'in-fabrication' },
    ],
  }
  const createBatch = writeBatch(db)
  createBatch.set(saleRef, sale)
  createBatch.update(createdStatusRef, {
    usageCount: 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  createBatch.update(fabricationStatusRef, {
    usageCount: 2, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  await assertSucceeds(createBatch.commit())
  await assertFails(deleteDoc(fabricationStatusRef))

  const editBatch = writeBatch(db)
  editBatch.update(saleRef, {
    items: [
      { itemId: 'item-1', amountCents: 5000, commissionRateBps: 1000, commissionCents: 500, quantity: 1, statusId: 'in-fabrication' },
      { itemId: 'item-2', amountCents: 5000, commissionRateBps: 1000, commissionCents: 500, quantity: 1, statusId: 'finished' },
    ],
    itemStatusUsage: { 'in-fabrication': 1, finished: 1 },
  })
  editBatch.update(fabricationStatusRef, {
    usageCount: 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  editBatch.update(finishedStatusRef, {
    usageCount: 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  await assertSucceeds(editBatch.commit())
  await assertFails(deleteDoc(fabricationStatusRef))

  const finalizeBatch = writeBatch(db)
  finalizeBatch.update(saleRef, {
    statusId: 'finished',
    items: [
      { itemId: 'item-1', amountCents: 5000, commissionRateBps: 1000, commissionCents: 500, quantity: 1, statusId: 'finished' },
      { itemId: 'item-2', amountCents: 5000, commissionRateBps: 1000, commissionCents: 500, quantity: 1, statusId: 'finished' },
    ],
    itemStatusUsage: { finished: 2 },
  })
  finalizeBatch.update(createdStatusRef, {
    usageCount: 0, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  finalizeBatch.update(fabricationStatusRef, {
    usageCount: 0, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  finalizeBatch.update(finishedStatusRef, {
    usageCount: 3, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  await assertSucceeds(finalizeBatch.commit())

  const deleteBatch = writeBatch(db)
  deleteBatch.delete(saleRef)
  deleteBatch.update(createdStatusRef, {
    usageCount: 0, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  deleteBatch.update(fabricationStatusRef, {
    usageCount: 0, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  deleteBatch.update(finishedStatusRef, {
    usageCount: 0, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp(),
  })
  await assertSucceeds(deleteBatch.commit())
  await assertSucceeds(deleteDoc(fabricationStatusRef))
})

test('permite a data de venda escolhida no passado e nega datas futuras', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()

  await assertSucceeds(setDoc(doc(db, 'companies', companyId, 'sales', 'backdated-sale'), transactionSaleData('alice', Timestamp.fromDate(new Date('2025-05-20T15:00:00Z')))))

  await assertFails(setDoc(doc(db, 'companies', companyId, 'sales', 'future-sale'), transactionSaleData('alice', Timestamp.fromDate(new Date('2099-05-20T15:00:00Z')))))
})

test('valida a estrutura geral do pedido e impede atribuir a venda a outro usuário', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const db = testEnvironment.authenticatedContext('alice').firestore()

  await assertFails(setDoc(doc(db, 'companies', companyId, 'sales', 'invalid-items'), {
    userId: 'alice', soldAt: serverTimestamp(), createdAt: serverTimestamp(), items: 'not-a-list',
  }))
  await assertFails(setDoc(doc(db, 'companies', companyId, 'sales', 'other-user'), transactionSaleData('bob')))
  await assertSucceeds(setDoc(doc(db, 'companies', companyId, 'sales', 'client-validated-item'), {
    userId: 'alice', soldAt: serverTimestamp(), createdAt: serverTimestamp(), items: [{}],
  }))
})

test('a consulta individual de vendas funciona e não revela vendas de terceiros', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'companies', companyId, 'sales', 'sale-alice'), {
      ...transactionSaleData('alice'),
    })
    await setDoc(doc(db, 'companies', companyId, 'sales', 'sale-bob'), {
      ...transactionSaleData('bob'),
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
      ...transactionSaleData('alice', Timestamp.fromDate(new Date('2025-05-20T15:00:00Z'))),
      createdAt: Timestamp.fromDate(new Date('2025-05-20T15:00:00Z')),
    })
  })
  const db = testEnvironment.authenticatedContext('alice').firestore()
  await assertSucceeds(updateDoc(doc(db, 'companies', companyId, 'sales', 'sale-1'), {
    soldAt: Timestamp.fromDate(new Date('2025-06-20T15:00:00Z')),
    items: [{ itemId: 'item-1', amountCents: 20000, commissionRateBps: 1500, commissionCents: 3000, quantity: 2 }],
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
    await setDoc(doc(db, 'companies', companyId, 'sales', 'sale-alice'), transactionSaleData('alice'))
    await setDoc(doc(db, 'companies', companyId, 'sales', 'sale-bob'), transactionSaleData('bob'))
  })
  const db = testEnvironment.authenticatedContext('alice').firestore()
  await assertSucceeds(deleteDoc(doc(db, 'companies', companyId, 'sales', 'sale-alice')))
  await assertFails(deleteDoc(doc(db, 'companies', companyId, 'sales', 'sale-bob')))
})

test('permite salvar a própria preferência de dashboard na empresa e bloqueia outros usuários', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  await seedCompany('bob', 'company-bob')
  const aliceDb = testEnvironment.authenticatedContext('alice').firestore()
  const preference = {
    visibleIndicators: ['period-summary', 'commission-rate-chart', 'commission-rate-commission', 'sales-history'],
    indicatorOrder: [
      'period-summary', 'average-commission', 'average-commission-rate',
      'average-sale', 'commission-rate-chart', 'commission-rate-details',
      'commission-rate-commission', 'product-sales-values', 'product-commissions',
      'product-sales-chart', 'product-commission-chart', 'goals-progress', 'sales-evolution', 'sales-history',
    ],
    updatedAt: serverTimestamp(),
  }

  await assertSucceeds(setDoc(doc(aliceDb, 'companies', companyId, 'dashboardPreferences', 'alice'), preference))
  await assertSucceeds(getDoc(doc(aliceDb, 'companies', companyId, 'dashboardPreferences', 'alice')))
  await assertFails(getDoc(doc(aliceDb, 'companies', companyId, 'dashboardPreferences', 'bob')))
  await assertFails(setDoc(doc(aliceDb, 'companies', companyId, 'dashboardPreferences', 'bob'), preference))
  await assertFails(setDoc(doc(aliceDb, 'companies', companyId, 'dashboardPreferences', 'alice'), {
    ...preference,
    visibleIndicators: ['private-data'],
  }))
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'companies', 'company-bob', 'dashboardPreferences', 'alice'), preference)
  })
  await assertFails(getDoc(doc(aliceDb, 'companies', 'company-bob', 'dashboardPreferences', 'alice')))
})

test('telas adicionais são compartilhadas para leitura ativa e gerenciadas somente pelo proprietário', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  const indicatorOrder = [
    'period-summary', 'average-commission', 'average-commission-rate', 'average-sale',
    'commission-rate-chart', 'commission-rate-details', 'commission-rate-commission',
    'product-sales-values', 'product-commissions', 'product-sales-chart', 'product-commission-chart',
    'goals-progress', 'sales-evolution', 'sales-history',
  ]
  const aliceDb = testEnvironment.authenticatedContext('alice').firestore()
  const activeScreen = doc(aliceDb, 'companies', companyId, 'customScreens', 'active-screen')
  const inactiveScreen = doc(aliceDb, 'companies', companyId, 'customScreens', 'inactive-screen')
  const screenData = (enabled, sortOrder) => ({
    name: enabled ? 'Tela ativa' : 'Tela pausada',
    enabled,
    visibleIndicators: ['period-summary'],
    indicatorOrder,
    sortOrder,
    createdByUid: 'alice',
    updatedByUid: 'alice',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await assertSucceeds(setDoc(activeScreen, screenData(true, 0)))
  await assertSucceeds(setDoc(inactiveScreen, screenData(false, 1)))
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'companies', companyId, 'members', 'bob'), {
      uid: 'bob', companyId, role: 'member', createdAt: Timestamp.now(),
    })
  })

  const bobDb = testEnvironment.authenticatedContext('bob').firestore()
  await assertSucceeds(getDoc(doc(bobDb, 'companies', companyId, 'customScreens', 'active-screen')))
  await assertFails(getDoc(doc(bobDb, 'companies', companyId, 'customScreens', 'inactive-screen')))
  await assertSucceeds(getDocs(query(
    collection(bobDb, 'companies', companyId, 'customScreens'),
    where('enabled', '==', true),
  )))
  await assertFails(getDocs(collection(bobDb, 'companies', companyId, 'customScreens')))
  await assertFails(updateDoc(doc(bobDb, 'companies', companyId, 'customScreens', 'active-screen'), {
    enabled: false,
    updatedByUid: 'bob',
    updatedAt: serverTimestamp(),
  }))
  await assertFails(deleteDoc(doc(bobDb, 'companies', companyId, 'customScreens', 'active-screen')))
  await assertSucceeds(deleteDoc(doc(aliceDb, 'companies', companyId, 'customScreens', 'inactive-screen')))
})

test('isola metas por usuário, mesmo quando ele é proprietário da empresa', async () => {
  const companyId = 'company-alice'
  await seedCompany('alice', companyId)
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'companies', companyId, 'members', 'bob'), {
      uid: 'bob', companyId, role: 'member', createdAt: Timestamp.now(),
    })
    await setDoc(doc(db, 'companies', companyId, 'goals', 'goal-alice'), {
      userId: 'alice', startDate: Timestamp.fromDate(new Date('2026-11-01T00:00:00Z')),
      endDate: Timestamp.fromDate(new Date('2026-11-30T00:00:00Z')), targetCents: 500000,
      businessDays: 26, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    })
  })
  const aliceDb = testEnvironment.authenticatedContext('alice').firestore()
  const bobDb = testEnvironment.authenticatedContext('bob').firestore()
  const bobGoal = {
    userId: 'bob', startDate: Timestamp.fromDate(new Date('2026-11-01T00:00:00Z')),
    endDate: Timestamp.fromDate(new Date('2026-11-30T00:00:00Z')), targetCents: 300000,
    businessDays: 26, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }

  await assertSucceeds(setDoc(doc(bobDb, 'companies', companyId, 'goals', 'goal-bob'), bobGoal))
  await assertFails(getDoc(doc(aliceDb, 'companies', companyId, 'goals', 'goal-bob')))
  await assertFails(getDoc(doc(bobDb, 'companies', companyId, 'goals', 'goal-alice')))
  await assertSucceeds(getDocs(query(collection(aliceDb, 'companies', companyId, 'goals'), where('userId', '==', 'alice'))))
  await assertSucceeds(getDocs(query(collection(bobDb, 'companies', companyId, 'goals'), where('userId', '==', 'bob'))))
  await assertFails(setDoc(doc(bobDb, 'companies', companyId, 'goals', 'forged-goal'), { ...bobGoal, userId: 'alice' }))
  await assertFails(updateDoc(doc(bobDb, 'companies', companyId, 'goals', 'goal-bob'), { targetCents: -10 }))
  await assertSucceeds(updateDoc(doc(bobDb, 'companies', companyId, 'goals', 'goal-bob'), { targetCents: 400000, updatedAt: serverTimestamp() }))
  await assertSucceeds(deleteDoc(doc(bobDb, 'companies', companyId, 'goals', 'goal-bob')))
  await assertFails(deleteDoc(doc(bobDb, 'companies', companyId, 'goals', 'goal-alice')))
})
