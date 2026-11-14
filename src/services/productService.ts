import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, Timestamp, type QueryDocumentSnapshot } from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import type { Product } from '../types/product'

function mapProduct(snapshot: QueryDocumentSnapshot): Product {
  const data = snapshot.data()
  if (typeof data.name !== 'string'
    || !(data.createdAt instanceof Timestamp)
    || !(data.updatedAt instanceof Timestamp)
    || typeof data.createdBy !== 'string'
    || typeof data.updatedBy !== 'string') {
    throw new Error(`O produto ${snapshot.id} contém dados inválidos.`)
  }
  return { productId: snapshot.id, name: data.name, ...(typeof data.description === 'string' ? { description: data.description } : {}), createdAt: data.createdAt, updatedAt: data.updatedAt, createdBy: data.createdBy, updatedBy: data.updatedBy }
}

export async function getCompanyProducts(companyId: string): Promise<Product[]> {
  const products = await getDocs(query(collection(firestore, 'companies', companyId, 'products'), orderBy('name')))
  return products.docs.map(mapProduct)
}

export async function createProduct(companyId: string, userId: string, name: string): Promise<Product> {
  const productRef = doc(collection(firestore, 'companies', companyId, 'products'))
  const now = Timestamp.now()
  const product: Product = { productId: productRef.id, name: name.trim(), createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId }
  await setDoc(productRef, { name: product.name, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: userId, updatedBy: userId })
  return product
}
