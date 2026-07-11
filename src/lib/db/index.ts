// SQL DB wrapper - Prisma API'ga mos, @tidbcloud/serverless driver orqali ishlaydi
// ============================================================================
// Bu wrapper @prisma/client o'rnini bosadi - barcha API route'lari o'zgartirilmasdan
// ishlaydi. Faqat `import { db } from '@/lib/db'` o'zgarishsiz qoladi.
//
// Qo'llab-quvvatlanadigan operatsiyalar:
//   - findUnique, findFirst, findMany
//   - create, update, delete
//   - count, aggregate, groupBy
//   - upsert, createMany, updateMany, deleteMany
//
// Where operatorlari: gte, lte, gt, lt, ne, contains, in, notIn, is, isNot, AND, OR, NOT
// Select, include (nested relations), orderBy, take, skip - qo'llab-quvvatlanadi

import { connect } from '@tidbcloud/serverless'
import modelsData from './models.json'

// ============================================================
// TYPES
// ============================================================
type ModelName = keyof typeof modelsData
type WhereInput = Record<string, any>
type DataInput = Record<string, any>
type SelectInput = Record<string, boolean>
type IncludeInput = Record<string, boolean | { include?: IncludeInput; select?: SelectInput; where?: WhereInput }>
type OrderByInput = Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>

interface FindManyArgs {
  where?: WhereInput
  orderBy?: OrderByInput
  take?: number
  skip?: number
  select?: SelectInput
  include?: IncludeInput
  distinct?: string[]
}

interface FindUniqueArgs {
  where: WhereInput
  select?: SelectInput
  include?: IncludeInput
}

interface CreateArgs {
  data: DataInput
  select?: SelectInput
  include?: IncludeInput
}

interface UpdateArgs {
  where: WhereInput
  data: DataInput
  select?: SelectInput
  include?: IncludeInput
}

interface DeleteArgs {
  where: WhereInput
  select?: SelectInput
  include?: IncludeInput
}

interface CountArgs {
  where?: WhereInput
}

interface AggregateArgs {
  where?: WhereInput
  _sum?: Record<string, boolean>
  _count?: Record<string, boolean> | true
  _avg?: Record<string, boolean>
  _min?: Record<string, boolean>
  _max?: Record<string, boolean>
}

interface GroupByArgs {
  by: string[]
  where?: WhereInput
  _count?: Record<string, boolean> | true
  _sum?: Record<string, boolean>
  _avg?: Record<string, boolean>
  _min?: Record<string, boolean>
  _max?: Record<string, boolean>
}

interface UpsertArgs {
  where: WhereInput
  create: DataInput
  update: DataInput
}

interface CreateManyArgs {
  data: DataInput[]
  skipDuplicates?: boolean
}

interface UpdateManyArgs {
  where: WhereInput
  data: DataInput
}

interface DeleteManyArgs {
  where: WhereInput
}

// ============================================================
// CONNECTION
// ============================================================
let _connection: any = null

function getConnection() {
  if (_connection) return _connection
  const url = process.env.TIDB_DATABASE_URL || process.env.DATABASE_URL
  if (!url || !url.startsWith('mysql://')) {
    throw new Error('[db] TiDB connection URL topilmadi. TIDB_DATABASE_URL yoki DATABASE_URL o\'rnatilishi kerak.')
  }
  _connection = connect({ url })
  return _connection
}

// ============================================================
// SQL EXECUTION
// ============================================================
async function execute(sql: string, args: any[] = []): Promise<any> {
  const conn = getConnection()
  try {
    const result = await conn.execute(sql, args)
    return result
  } catch (err: any) {
    console.error('[db] SQL error:', err.message)
    console.error('[db] SQL:', sql.substring(0, 500))
    console.error('[db] Args:', JSON.stringify(args).substring(0, 500))
    throw err
  }
}

// ============================================================
// ID GENERATION (cuid, uuid)
// ============================================================
// Prisma'dagi @default(cuid()) va @default(uuid()) ni simulyatsiya qilish
let _counter = 0
function generateCuid(): string {
  // Prisma'ning cuid() formati: c + 24-char base36
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 10)
  const cnt = (_counter++).toString(36).padStart(4, '0')
  return `c${ts}${rand}${cnt}`.substring(0, 24)
}

function generateUuid(): string {
  // UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ============================================================
// HELPERS
// ============================================================

// Model fieldlarini olish
function getFields(modelName: string): any[] {
  const model = (modelsData as any)[modelName]
  if (!model) throw new Error(`[db] Model topilmadi: ${modelName}`)
  return model.fields
}

// Scalar (munosabat bo'lmagan) maydonlar
function getScalarFields(modelName: string): any[] {
  return getFields(modelName).filter((f: any) => !f.isRelation)
}

// ID maydoni
function getIdField(modelName: string): string {
  const idField = getFields(modelName).find((f: any) => f.isId)
  return idField ? idField.name : 'id'
}

// Unique maydonlar (id + @unique)
function getUniqueFields(modelName: string): string[] {
  const fields = getFields(modelName)
  return fields.filter((f: any) => f.isId || f.isUnique).map((f: any) => f.name)
}

// Relation maydoni ma'lumotini olish
function getRelationField(modelName: string, fieldName: string): any {
  const model = (modelsData as any)[modelName]
  return model.fields.find((f: any) => f.name === fieldName && f.isRelation)
}

// Prisma model nomi -> MySQL jadval nomi (PascalCase bilan bir xil)
function getTableName(modelName: string): string {
  return modelName
}

// MySQL identifier escape
function escapeIdentifier(name: string): string {
  return '`' + name.replace(/`/g, '``') + '`'
}

// ============================================================
// WHERE BUILDER
// ============================================================
function buildWhere(where: WhereInput, modelName?: string): { sql: string; args: any[] } {
  const conditions: string[] = []
  const args: any[] = []

  if (!where || Object.keys(where).length === 0) {
    return { sql: '', args: [] }
  }

  for (const [key, value] of Object.entries(where)) {
    // AND, OR, NOT
    if (key === 'AND' && Array.isArray(value)) {
      const subConditions: string[] = []
      for (const subWhere of value) {
        const sub = buildWhere(subWhere, modelName)
        if (sub.sql) {
          subConditions.push(`(${sub.sql})`)
          args.push(...sub.args)
        }
      }
      if (subConditions.length) conditions.push(`(${subConditions.join(' AND ')})`)
      continue
    }
    if (key === 'OR' && Array.isArray(value)) {
      const subConditions: string[] = []
      for (const subWhere of value) {
        const sub = buildWhere(subWhere, modelName)
        if (sub.sql) {
          subConditions.push(`(${sub.sql})`)
          args.push(...sub.args)
        }
      }
      if (subConditions.length) conditions.push(`(${subConditions.join(' OR ')})`)
      continue
    }
    if (key === 'NOT') {
      const sub = buildWhere(value, modelName)
      if (sub.sql) {
        conditions.push(`NOT (${sub.sql})`)
        args.push(...sub.args)
      }
      continue
    }

    // Relation filter: { sale: { restaurantId: 'xxx' } }
    if (modelName) {
      const relField = getRelationField(modelName, key)
      if (relField && typeof value === 'object' && !Array.isArray(value) && !isOperator(value)) {
        // Nested relation filter - JOIN kerak
        if (relField.isList) {
          // "one" tomonidagi relation - related modeldan filter
          const subModel = relField.type
          const subWhere = buildWhere(value, subModel)
          if (subWhere.sql) {
            conditions.push(`${escapeIdentifier(getTableName(modelName))}.${escapeIdentifier(relField.localField || 'id')} IN (SELECT ${escapeIdentifier(relField.foreignField || 'id')} FROM ${escapeIdentifier(getTableName(subModel))} WHERE ${subWhere.sql})`)
            args.push(...subWhere.args)
          }
        } else {
          // "many" tomonidagi relation - local FK
          const subModel = relField.type
          const subWhere = buildWhere(value, subModel)
          if (subWhere.sql) {
            conditions.push(`${escapeIdentifier(relField.localField)} IN (SELECT ${escapeIdentifier(relField.foreignField || 'id')} FROM ${escapeIdentifier(getTableName(subModel))} WHERE ${subWhere.sql})`)
            args.push(...subWhere.args)
          }
        }
        continue
      }
    }

    // Operator: { field: { gte: value, contains: value, in: [...], ... } }
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Check if it's an operator object
      const ops = Object.keys(value)
      const isOps = ops.every(op => ['gte', 'lte', 'gt', 'lt', 'ne', 'equals', 'contains', 'startsWith', 'endsWith', 'in', 'notIn', 'is', 'isNot', 'not', 'between'].includes(op))

      if (isOps) {
        for (const [op, opVal] of Object.entries(value)) {
          const col = escapeIdentifier(key)
          switch (op) {
            case 'gte':
              conditions.push(`${col} >= ?`)
              args.push(opVal)
              break
            case 'lte':
              conditions.push(`${col} <= ?`)
              args.push(opVal)
              break
            case 'gt':
              conditions.push(`${col} > ?`)
              args.push(opVal)
              break
            case 'lt':
              conditions.push(`${col} < ?`)
              args.push(opVal)
              break
            case 'ne':
            case 'not':
              if (opVal === null) {
                conditions.push(`${col} IS NOT NULL`)
              } else {
                conditions.push(`${col} != ?`)
                args.push(opVal)
              }
              break
            case 'equals':
              if (opVal === null) {
                conditions.push(`${col} IS NULL`)
              } else {
                conditions.push(`${col} = ?`)
                args.push(opVal)
              }
              break
            case 'contains':
              conditions.push(`${col} LIKE ?`)
              args.push(`%${opVal}%`)
              break
            case 'startsWith':
              conditions.push(`${col} LIKE ?`)
              args.push(`${opVal}%`)
              break
            case 'endsWith':
              conditions.push(`${col} LIKE ?`)
              args.push(`%${opVal}`)
              break
            case 'in':
              if (Array.isArray(opVal) && opVal.length > 0) {
                const placeholders = opVal.map(() => '?').join(', ')
                conditions.push(`${col} IN (${placeholders})`)
                args.push(...opVal)
              } else {
                conditions.push('1=0') // bo'sh IN - hech narsa topmaydi
              }
              break
            case 'notIn':
              if (Array.isArray(opVal) && opVal.length > 0) {
                const placeholders = opVal.map(() => '?').join(', ')
                conditions.push(`${col} NOT IN (${placeholders})`)
                args.push(...opVal)
              }
              break
            case 'is':
              if (opVal === null) {
                conditions.push(`${col} IS NULL`)
              } else {
                conditions.push(`${col} = ?`)
                args.push(opVal)
              }
              break
            case 'isNot':
              if (opVal === null) {
                conditions.push(`${col} IS NOT NULL`)
              } else {
                conditions.push(`${col} != ?`)
                args.push(opVal)
              }
              break
            case 'between':
              if (Array.isArray(opVal) && opVal.length === 2) {
                conditions.push(`${col} BETWEEN ? AND ?`)
                args.push(opVal[0], opVal[1])
              }
              break
          }
        }
        continue
      }
    }

    // Direct value: { field: value }
    if (value === null) {
      conditions.push(`${escapeIdentifier(key)} IS NULL`)
    } else if (value instanceof Date) {
      conditions.push(`${escapeIdentifier(key)} = ?`)
      args.push(value)
    } else {
      conditions.push(`${escapeIdentifier(key)} = ?`)
      args.push(value)
    }
  }

  return {
    sql: conditions.length ? conditions.join(' AND ') : '',
    args,
  }
}

function isOperator(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false
  return Object.keys(obj).some(op => ['gte', 'lte', 'gt', 'lt', 'ne', 'equals', 'contains', 'startsWith', 'endsWith', 'in', 'notIn', 'is', 'isNot', 'not', 'between'].includes(op))
}

// ============================================================
// ORDER BY BUILDER
// ============================================================
function buildOrderBy(orderBy: OrderByInput): string {
  if (!orderBy) return ''
  if (Array.isArray(orderBy)) {
    return orderBy.map(o => {
      const [field, dir] = Object.entries(o)[0]
      return `${escapeIdentifier(field)} ${dir.toUpperCase()}`
    }).join(', ')
  }
  const [field, dir] = Object.entries(orderBy)[0]
  return `${escapeIdentifier(field)} ${dir.toUpperCase()}`
}

// ============================================================
// SELECT BUILDER
// ============================================================
function buildSelect(modelName: string, select?: SelectInput): string {
  if (!select) {
    // Barcha scalar maydonlar
    const scalarFields = getScalarFields(modelName)
    return scalarFields.map((f: any) => escapeIdentifier(f.name)).join(', ')
  }
  return Object.entries(select)
    .filter(([_, v]) => v === true)
    .map(([k]) => escapeIdentifier(k))
    .join(', ')
}

// ============================================================
// DATA BUILDER (create/update uchun)
// ============================================================
function buildCreateData(modelName: string, data: DataInput): { columns: string[]; placeholders: string[]; args: any[]; generatedId?: string } {
  const columns: string[] = []
  const placeholders: string[] = []
  const args: any[] = []
  let generatedId: string | undefined

  const scalarFields = getScalarFields(modelName)

  // Avval data'dagi barcha scalar maydonlarni qo'shamiz
  const providedFields = new Set<string>()
  for (const [key, value] of Object.entries(data)) {
    // Skip nested create/connect (relations)
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // connect: { id: 'xxx' } -> set FK
      if (value.connect) {
        const connectWhere = value.connect
        const connectKey = Object.keys(connectWhere)[0]
        const relField = getRelationField(modelName, key)
        if (relField && relField.localField) {
          columns.push(escapeIdentifier(relField.localField))
          placeholders.push('?')
          args.push(connectWhere[connectKey])
          providedFields.add(relField.localField)
        }
        continue
      }
      // create: {...} -> skip (would need nested create, complex)
      if (value.create) continue
      continue
    }

    // Only scalar fields
    if (!scalarFields.find((f: any) => f.name === key)) continue

    columns.push(escapeIdentifier(key))
    if (value instanceof Date) {
      placeholders.push('?')
      args.push(value)
    } else if (value === undefined) {
      continue
    } else {
      placeholders.push('?')
      args.push(value)
    }
    providedFields.add(key)
  }

  // Endi default qiymatlari bor, lekin data'da berilmagan maydonlarni qo'shamiz
  for (const field of scalarFields) {
    if (providedFields.has(field.name)) continue

    let val: any = undefined

    // @updatedAt maydonlari - Prisma create'da ham avtomatik o'rnatadi
    if (field.isUpdatedAt) {
      val = new Date()
    }
    // @default bilan maydonlar
    else if (field.hasDefault) {
      switch (field.defaultExpression) {
        case 'cuid':
          val = generateCuid()
          if (field.isId) generatedId = val
          break
        case 'uuid':
          val = generateUuid()
          if (field.isId) generatedId = val
          break
        case 'now':
          val = new Date()
          break
        case 'autoincrement':
          // Skip - DB handles it
          continue
        case 'literal':
          val = field.defaultValue
          break
      }
    } else {
      continue
    }

    if (val !== undefined) {
      columns.push(escapeIdentifier(field.name))
      placeholders.push('?')
      args.push(val)
    }
  }

  return { columns, placeholders, args, generatedId }
}

function buildUpdateData(modelName: string, data: DataInput): { setClauses: string[]; args: any[] } {
  const setClauses: string[] = []
  const args: any[] = []
  const scalarFields = getScalarFields(modelName)

  for (const [key, value] of Object.entries(data)) {
    // Skip nested update/connect (relations)
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      if (value.connect) {
        const connectWhere = value.connect
        const connectKey = Object.keys(connectWhere)[0]
        const relField = getRelationField(modelName, key)
        if (relField && relField.localField) {
          setClauses.push(`${escapeIdentifier(relField.localField)} = ?`)
          args.push(connectWhere[connectKey])
        }
        continue
      }
      // increment, decrement, multiply, divide (number operations)
      if (value.increment !== undefined) {
        if (!scalarFields.find((f: any) => f.name === key)) continue
        setClauses.push(`${escapeIdentifier(key)} = ${escapeIdentifier(key)} + ?`)
        args.push(value.increment)
        continue
      }
      if (value.decrement !== undefined) {
        if (!scalarFields.find((f: any) => f.name === key)) continue
        setClauses.push(`${escapeIdentifier(key)} = ${escapeIdentifier(key)} - ?`)
        args.push(value.decrement)
        continue
      }
      if (value.multiply !== undefined) {
        if (!scalarFields.find((f: any) => f.name === key)) continue
        setClauses.push(`${escapeIdentifier(key)} = ${escapeIdentifier(key)} * ?`)
        args.push(value.multiply)
        continue
      }
      if (value.divide !== undefined) {
        if (!scalarFields.find((f: any) => f.name === key)) continue
        setClauses.push(`${escapeIdentifier(key)} = ${escapeIdentifier(key)} / ?`)
        args.push(value.divide)
        continue
      }
      // update: {...} or create: {...} - skip (nested)
      if (value.update || value.create || value.connectOrCreate) continue
      continue
    }

    if (!scalarFields.find((f: any) => f.name === key)) continue

    if (value === undefined) continue
    setClauses.push(`${escapeIdentifier(key)} = ?`)
    args.push(value)
  }

  return { setClauses, args }
}

// ============================================================
// ROW CONVERTER (DB row -> app object)
// ============================================================
function convertRow(modelName: string, row: any): any {
  if (!row) return null
  const fields = getFields(modelName)
  const result: any = {}

  for (const field of fields) {
    if (field.isRelation) continue
    const col = field.name
    if (row[col] === undefined) continue

    const value = row[col]
    // Type conversion
    if (field.type === 'DateTime' && value !== null && typeof value === 'string') {
      result[col] = new Date(value)
    } else if (field.type === 'Boolean' && value !== null) {
      result[col] = Boolean(value)
    } else if (field.type === 'Int' && value !== null) {
      result[col] = parseInt(value, 10)
    } else if (field.type === 'Float' && value !== null) {
      result[col] = parseFloat(value)
    } else {
      result[col] = value
    }
  }

  return result
}

// ============================================================
// INCLUDE (relations)
// ============================================================
async function loadIncludes(modelName: string, records: any[], include: IncludeInput): Promise<void> {
  if (!include || records.length === 0) return

  for (const [relName, includeVal] of Object.entries(include)) {
    const relField = getRelationField(modelName, relName)
    if (!relField) continue

    const subInclude = typeof includeVal === 'object' ? includeVal.include : undefined
    const subSelect = typeof includeVal === 'object' ? includeVal.select : undefined
    const subWhere = typeof includeVal === 'object' ? includeVal.where : undefined

    const subModel = relField.type

    if (relField.isList) {
      // "one" tomon - bitta record'ga ko'p related
      const localField = relField.localField || 'id'
      const foreignField = relField.foreignField || 'id'
      const ids = records.map(r => r[localField]).filter(Boolean)
      if (ids.length === 0) {
        for (const r of records) r[relName] = []
        continue
      }

      const placeholders = ids.map(() => '?').join(', ')
      const whereClause = subWhere ? buildWhere(subWhere, subModel) : { sql: '', args: [] }
      const whereSql = whereClause.sql ? ` AND ${whereClause.sql}` : ''
      const selectCols = buildSelect(subModel, subSelect)

      const sql = `SELECT ${selectCols} FROM ${escapeIdentifier(getTableName(subModel))} WHERE ${escapeIdentifier(foreignField)} IN (${placeholders})${whereSql}`
      const subRows = await execute(sql, [...ids, ...whereClause.args])

      // Group by foreign key
      const grouped = new Map<string, any[]>()
      for (const row of subRows) {
        const fk = row[foreignField]
        if (!grouped.has(fk)) grouped.set(fk, [])
        grouped.get(fk)!.push(convertRow(subModel, row))
      }

      for (const r of records) {
        r[relName] = grouped.get(r[localField]) || []
      }

      // Recursive include
      if (subInclude) {
        const allSubRecords = Array.from(grouped.values()).flat()
        await loadIncludes(subModel, allSubRecords, subInclude)
      }
    } else {
      // "many" tomon - bitta record'ga bitta related
      const localField = relField.localField
      const foreignField = relField.foreignField || 'id'
      if (!localField) continue

      const ids = records.map(r => r[localField]).filter(Boolean)
      if (ids.length === 0) {
        for (const r of records) r[relName] = null
        continue
      }

      const placeholders = ids.map(() => '?').join(', ')
      const whereClause = subWhere ? buildWhere(subWhere, subModel) : { sql: '', args: [] }
      const whereSql = whereClause.sql ? ` AND ${whereClause.sql}` : ''
      const selectCols = buildSelect(subModel, subSelect)

      const sql = `SELECT ${selectCols} FROM ${escapeIdentifier(getTableName(subModel))} WHERE ${escapeIdentifier(foreignField)} IN (${placeholders})${whereSql}`
      const subRows = await execute(sql, [...ids, ...whereClause.args])

      const byId = new Map<string, any>()
      for (const row of subRows) {
        byId.set(row[foreignField], convertRow(subModel, row))
      }

      for (const r of records) {
        r[relName] = byId.get(r[localField]) || null
      }

      // Recursive include
      if (subInclude) {
        const subRecords = Array.from(byId.values()).filter(Boolean)
        await loadIncludes(subModel, subRecords, subInclude)
      }
    }
  }
}

// ============================================================
// MODEL OPERATIONS
// ============================================================
class ModelDelegate {
  constructor(private modelName: string) {}

  async findUnique(args: FindUniqueArgs): Promise<any> {
    const where = buildWhere(args.where, this.modelName)
    if (!where.sql) throw new Error('[db] findUnique: where talab qilinadi')

    const selectCols = buildSelect(this.modelName, args.select)
    const sql = `SELECT ${selectCols} FROM ${escapeIdentifier(getTableName(this.modelName))} WHERE ${where.sql} LIMIT 1`
    const rows = await execute(sql, where.args)
    const record = convertRow(this.modelName, rows[0])

    if (record && args.include) {
      await loadIncludes(this.modelName, [record], args.include)
    }

    return record || null
  }

  async findFirst(args: FindManyArgs = {}): Promise<any> {
    const where = args.where ? buildWhere(args.where, this.modelName) : { sql: '', args: [] }
    const whereSql = where.sql ? ` WHERE ${where.sql}` : ''
    const selectCols = buildSelect(this.modelName, args.select)
    const orderBySql = args.orderBy ? ` ORDER BY ${buildOrderBy(args.orderBy)}` : ''
    const skipSql = args.skip ? ` OFFSET ${parseInt(args.skip as any, 10)}` : ''

    const sql = `SELECT ${selectCols} FROM ${escapeIdentifier(getTableName(this.modelName))}${whereSql}${orderBySql} LIMIT 1${skipSql}`
    const rows = await execute(sql, where.args)
    const record = convertRow(this.modelName, rows[0])

    if (record && args.include) {
      await loadIncludes(this.modelName, [record], args.include)
    }

    return record || null
  }

  async findMany(args: FindManyArgs = {}): Promise<any[]> {
    const where = args.where ? buildWhere(args.where, this.modelName) : { sql: '', args: [] }
    const whereSql = where.sql ? ` WHERE ${where.sql}` : ''
    const selectCols = buildSelect(this.modelName, args.select)
    const orderBySql = args.orderBy ? ` ORDER BY ${buildOrderBy(args.orderBy)}` : ''
    const limitSql = args.take !== undefined ? ` LIMIT ${parseInt(args.take as any, 10)}` : ''
    const skipSql = args.skip ? ` OFFSET ${parseInt(args.skip as any, 10)}` : ''
    const distinctSql = args.distinct && args.distinct.length ? ` GROUP BY ${args.distinct.map((f: string) => escapeIdentifier(f)).join(', ')}` : ''

    const sql = `SELECT ${selectCols} FROM ${escapeIdentifier(getTableName(this.modelName))}${whereSql}${distinctSql}${orderBySql}${limitSql}${skipSql}`
    const rows = await execute(sql, where.args)
    const records = rows.map((r: any) => convertRow(this.modelName, r))

    if (args.include && records.length > 0) {
      await loadIncludes(this.modelName, records, args.include)
    }

    return records
  }

  async create(args: CreateArgs): Promise<any> {
    const { columns, placeholders, args: dataArgs, generatedId } = buildCreateData(this.modelName, args.data)

    if (columns.length === 0) {
      const sql = `INSERT INTO ${escapeIdentifier(getTableName(this.modelName))} () VALUES ()`
      await execute(sql, [])
    } else {
      const sql = `INSERT INTO ${escapeIdentifier(getTableName(this.modelName))} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`
      await execute(sql, dataArgs)
    }

    // Get the created record
    const idField = getIdField(this.modelName)
    let where: WhereInput
    if (args.data[idField]) {
      where = { [idField]: args.data[idField] }
    } else if (generatedId) {
      where = { [idField]: generatedId }
    } else {
      // Fallback: unique field orvqasidan qidirish
      const uniqueFields = getUniqueFields(this.modelName)
      const foundField = uniqueFields.find(f => args.data[f] !== undefined)
      if (foundField) {
        where = { [foundField]: args.data[foundField] }
      } else {
        // Last resort - use email/code/token if present
        const fallbackField = ['email', 'code', 'token', 'name'].find(f => args.data[f])
        if (fallbackField) {
          where = { [fallbackField]: args.data[fallbackField] }
        } else {
          throw new Error('[db] create: cannot fetch created record - no unique field provided')
        }
      }
    }

    return this.findUnique({ where, select: args.select, include: args.include })
  }

  async update(args: UpdateArgs): Promise<any> {
    const where = buildWhere(args.where, this.modelName)
    if (!where.sql) throw new Error('[db] update: where talab qilinadi')

    const { setClauses, args: setArgs } = buildUpdateData(this.modelName, args.data)

    // @updatedAt maydonlarini avtomatik yangilash (Prisma xuddi shunday qiladi)
    const scalarFields = getScalarFields(this.modelName)
    const updatedAtFields = scalarFields.filter((f: any) => f.isUpdatedAt)
    const extraSetClauses: string[] = []
    const extraArgs: any[] = []
    for (const f of updatedAtFields) {
      // Faqat data'da berilmagan bo'lsa avtomatik yangilaymiz
      if (!(f.name in args.data)) {
        extraSetClauses.push(`${escapeIdentifier(f.name)} = ?`)
        extraArgs.push(new Date())
      }
    }

    const allSetClauses = [...setClauses, ...extraSetClauses]
    const allArgs = [...setArgs, ...extraArgs]

    if (allSetClauses.length === 0) {
      return this.findUnique({ where: args.where, select: args.select, include: args.include })
    }

    const sql = `UPDATE ${escapeIdentifier(getTableName(this.modelName))} SET ${allSetClauses.join(', ')} WHERE ${where.sql}`
    await execute(sql, [...allArgs, ...where.args])

    return this.findUnique({ where: args.where, select: args.select, include: args.include })
  }

  async delete(args: DeleteArgs): Promise<any> {
    // Avval record'ni olish (return uchun)
    const record = await this.findUnique({ where: args.where, select: args.select, include: args.include })

    const where = buildWhere(args.where, this.modelName)
    if (!where.sql) throw new Error('[db] delete: where talab qilinadi')

    const sql = `DELETE FROM ${escapeIdentifier(getTableName(this.modelName))} WHERE ${where.sql}`
    await execute(sql, where.args)

    return record
  }

  async count(args: CountArgs = {}): Promise<number> {
    const where = args.where ? buildWhere(args.where, this.modelName) : { sql: '', args: [] }
    const whereSql = where.sql ? ` WHERE ${where.sql}` : ''
    const sql = `SELECT COUNT(*) as count FROM ${escapeIdentifier(getTableName(this.modelName))}${whereSql}`
    const rows = await execute(sql, where.args)
    return parseInt(rows[0]?.count || 0, 10)
  }

  async aggregate(args: AggregateArgs): Promise<any> {
    const where = args.where ? buildWhere(args.where, this.modelName) : { sql: '', args: [] }
    const whereSql = where.sql ? ` WHERE ${where.sql}` : ''

    const selects: string[] = []
    if (args._count === true) {
      selects.push('COUNT(*) as _count')
    } else if (args._count) {
      // _all special key = COUNT(*)
      if (args._count._all) {
        selects.push('COUNT(*) as _count_all')
      }
      for (const field of Object.keys(args._count)) {
        if (field === '_all') continue
        selects.push(`COUNT(${escapeIdentifier(field)}) as _count_${field}`)
      }
    }
    if (args._sum) {
      for (const field of Object.keys(args._sum)) {
        selects.push(`SUM(${escapeIdentifier(field)}) as _sum_${field}`)
      }
    }
    if (args._avg) {
      for (const field of Object.keys(args._avg)) {
        selects.push(`AVG(${escapeIdentifier(field)}) as _avg_${field}`)
      }
    }
    if (args._min) {
      for (const field of Object.keys(args._min)) {
        selects.push(`MIN(${escapeIdentifier(field)}) as _min_${field}`)
      }
    }
    if (args._max) {
      for (const field of Object.keys(args._max)) {
        selects.push(`MAX(${escapeIdentifier(field)}) as _max_${field}`)
      }
    }

    if (selects.length === 0) {
      selects.push('COUNT(*) as _count')
    }

    const sql = `SELECT ${selects.join(', ')} FROM ${escapeIdentifier(getTableName(this.modelName))}${whereSql}`
    const rows = await execute(sql, where.args)
    const row = rows[0] || {}

    // Format result like Prisma
    const result: any = {}
    if (args._count === true) {
      result._count = parseInt(row._count || 0, 10)
    } else if (args._count) {
      result._count = {}
      if (args._count._all) {
        result._count._all = parseInt(row._count_all || 0, 10)
      }
      for (const field of Object.keys(args._count)) {
        if (field === '_all') continue
        result._count[field] = parseInt(row[`_count_${field}`] || 0, 10)
      }
    }
    if (args._sum) {
      result._sum = {}
      for (const field of Object.keys(args._sum)) {
        result._sum[field] = row[`_sum_${field}`] !== null ? parseFloat(row[`_sum_${field}`]) : null
      }
    }
    if (args._avg) {
      result._avg = {}
      for (const field of Object.keys(args._avg)) {
        result._avg[field] = row[`_avg_${field}`] !== null ? parseFloat(row[`_avg_${field}`]) : null
      }
    }
    if (args._min) {
      result._min = {}
      for (const field of Object.keys(args._min)) {
        const val = row[`_min_${field}`]
        result._min[field] = val
      }
    }
    if (args._max) {
      result._max = {}
      for (const field of Object.keys(args._max)) {
        const val = row[`_max_${field}`]
        result._max[field] = val
      }
    }

    return result
  }

  async groupBy(args: GroupByArgs): Promise<any[]> {
    const where = args.where ? buildWhere(args.where, this.modelName) : { sql: '', args: [] }
    const whereSql = where.sql ? ` WHERE ${where.sql}` : ''

    const groupByCols = args.by.map((f: string) => escapeIdentifier(f)).join(', ')

    const selects: string[] = [...args.by.map((f: string) => escapeIdentifier(f))]
    if (args._count === true) {
      selects.push('COUNT(*) as _count')
    } else if (args._count) {
      // _all special key = COUNT(*)
      if ((args._count as any)._all) {
        selects.push('COUNT(*) as _count_all')
      }
      for (const field of Object.keys(args._count)) {
        if (field === '_all') continue
        selects.push(`COUNT(${escapeIdentifier(field)}) as _count_${field}`)
      }
    }
    if (args._sum) {
      for (const field of Object.keys(args._sum)) {
        selects.push(`SUM(${escapeIdentifier(field)}) as _sum_${field}`)
      }
    }
    if (args._avg) {
      for (const field of Object.keys(args._avg)) {
        selects.push(`AVG(${escapeIdentifier(field)}) as _avg_${field}`)
      }
    }
    if (args._min) {
      for (const field of Object.keys(args._min)) {
        selects.push(`MIN(${escapeIdentifier(field)}) as _min_${field}`)
      }
    }
    if (args._max) {
      for (const field of Object.keys(args._max)) {
        selects.push(`MAX(${escapeIdentifier(field)}) as _max_${field}`)
      }
    }

    const sql = `SELECT ${selects.join(', ')} FROM ${escapeIdentifier(getTableName(this.modelName))}${whereSql} GROUP BY ${groupByCols}`
    const rows = await execute(sql, where.args)

    return rows.map((row: any) => {
      const result: any = {}
      for (const field of args.by) {
        result[field] = row[field]
      }
      if (args._count === true) {
        result._count = parseInt(row._count || 0, 10)
      } else if (args._count) {
        result._count = {}
        if ((args._count as any)._all) {
          result._count._all = parseInt(row._count_all || 0, 10)
        }
        for (const field of Object.keys(args._count)) {
          if (field === '_all') continue
          result._count[field] = parseInt(row[`_count_${field}`] || 0, 10)
        }
      }
      if (args._sum) {
        result._sum = {}
        for (const field of Object.keys(args._sum)) {
          result._sum[field] = row[`_sum_${field}`] !== null ? parseFloat(row[`_sum_${field}`]) : null
        }
      }
      if (args._avg) {
        result._avg = {}
        for (const field of Object.keys(args._avg)) {
          result._avg[field] = row[`_avg_${field}`] !== null ? parseFloat(row[`_avg_${field}`]) : null
        }
      }
      if (args._min) {
        result._min = {}
        for (const field of Object.keys(args._min)) {
          result._min[field] = row[`_min_${field}`]
        }
      }
      if (args._max) {
        result._max = {}
        for (const field of Object.keys(args._max)) {
          result._max[field] = row[`_max_${field}`]
        }
      }
      return result
    })
  }

  async upsert(args: UpsertArgs): Promise<any> {
    const existing = await this.findUnique({ where: args.where })
    if (existing) {
      return this.update({ where: args.where, data: args.update })
    }
    // Merge where into create data (for unique fields)
    const createData = { ...args.where, ...args.create }
    return this.create({ data: createData })
  }

  async createMany(args: CreateManyArgs): Promise<{ count: number }> {
    if (args.data.length === 0) return { count: 0 }

    let count = 0
    for (const item of args.data) {
      const { columns, placeholders, args: dataArgs } = buildCreateData(this.modelName, item)
      if (columns.length === 0) {
        const sql = `INSERT INTO ${escapeIdentifier(getTableName(this.modelName))} () VALUES ()`
        await execute(sql)
      } else {
        const sql = `INSERT INTO ${escapeIdentifier(getTableName(this.modelName))} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`
        await execute(sql, dataArgs)
      }
      count++
    }
    return { count }
  }

  async updateMany(args: UpdateManyArgs): Promise<{ count: number }> {
    const where = buildWhere(args.where, this.modelName)
    if (!where.sql) throw new Error('[db] updateMany: where talab qilinadi')

    const { setClauses, args: setArgs } = buildUpdateData(this.modelName, args.data)
    if (setClauses.length === 0) return { count: 0 }

    const sql = `UPDATE ${escapeIdentifier(getTableName(this.modelName))} SET ${setClauses.join(', ')} WHERE ${where.sql}`
    const result = await execute(sql, [...setArgs, ...where.args])
    return { count: result.affectedRows || 0 }
  }

  async deleteMany(args: DeleteManyArgs): Promise<{ count: number }> {
    const where = buildWhere(args.where, this.modelName)
    if (!where.sql) throw new Error('[db] deleteMany: where talab qilinadi')

    const sql = `DELETE FROM ${escapeIdentifier(getTableName(this.modelName))} WHERE ${where.sql}`
    const result = await execute(sql, where.args)
    return { count: result.affectedRows || 0 }
  }
}

// ============================================================
// MAIN db OBJECT
// ============================================================
// Prisma API: db.restaurant (kichik harf bilan boshlanadi)
// Schema model: Restaurant (katta harf bilan)
// Shu sababli case conversion qilamiz
const _delegates = new Map<string, ModelDelegate>()

// Model nomi (PascalCase) -> Prisma property (camelCase)
function toPropertyName(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1)
}

// Prisma property (camelCase) -> Model nomi (PascalCase)
function toModelName(prop: string): string {
  return prop.charAt(0).toUpperCase() + prop.slice(1)
}

// Barcha model nomlarini saqlaymiz (Property -> ModelName mapping)
const _modelMap = new Map<string, string>()
for (const modelName of Object.keys(modelsData)) {
  _modelMap.set(toPropertyName(modelName), modelName)
}

export const db = new Proxy({} as any, {
  get(_target, prop: string) {
    if (typeof prop !== 'string') return undefined

    // camelCase -> PascalCase model name
    const modelName = _modelMap.get(prop)
    if (!modelName) return undefined

    if (!_delegates.has(modelName)) {
      _delegates.set(modelName, new ModelDelegate(modelName))
    }
    return _delegates.get(modelName)
  },
})
