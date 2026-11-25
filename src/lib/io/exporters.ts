import type { Project } from '../types'
import { slugify } from '../format'
import { download } from './download'
import { projectToItemsCsv, projectToRecipesCsv, projectToSnbt, questbookToSnbt } from './snbt'

const baseName = (project: Project) => slugify(project.name) || 'project'

export function exportProjectJson(project: Project) {
  download(`${baseName(project)}.json`, JSON.stringify(project, null, 2), 'application/json')
}

export function exportItemsCsv(project: Project) {
  download(`${baseName(project)}-items.csv`, projectToItemsCsv(project), 'text/csv')
}

export function exportRecipesCsv(project: Project) {
  download(`${baseName(project)}-recipes.csv`, projectToRecipesCsv(project), 'text/csv')
}

export function exportSnbt(project: Project) {
  download(`${baseName(project)}.snbt`, projectToSnbt(project))
}

export function exportQuestbook(project: Project) {
  download(`${baseName(project)}-questbook.snbt`, questbookToSnbt(project))
}
