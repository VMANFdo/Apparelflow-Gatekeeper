import { db } from '@/server/db'
import { recipes, recipeComponents } from '../../../db/schema'
import { eq, sql } from 'drizzle-orm'

export default async function HomePage() {
  // Fetch recipes with their component counts
  const recipeData = await db
    .select({
      id: recipes.id,
      recipeCode: recipes.recipeCode,
      name: recipes.name,
      category: recipes.category,
      stdFabricYards: recipes.stdFabricYards,
      componentCount: sql<number>`count(${recipeComponents.id})`.mapWith(Number),
    })
    .from(recipes)
    .leftJoin(recipeComponents, eq(recipes.id, recipeComponents.recipeId))
    .groupBy(recipes.id)
    .orderBy(recipes.recipeCode)

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">ApparelFlow ERP</h1>
          <p className="text-slate-600">Database connectivity verified. Found {recipeData.length} recipes.</p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          {recipeData.map((recipe) => (
            <div
              key={recipe.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4">
                <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {recipe.recipeCode}
                </span>
              </div>
              <h2 className="text-xl font-semibold">{recipe.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{recipe.category}</p>
              
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Fabric per garment</p>
                  <p className="font-semibold">{recipe.stdFabricYards} yds</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Components</p>
                  <p className="font-semibold">{recipe.componentCount} parts</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
