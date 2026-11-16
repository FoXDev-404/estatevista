import { ApiError } from './errors.js';

export async function nextDocumentNumber(supabase, companyId, documentType) {
  const { data, error } = await supabase.rpc('next_document_number', {
    p_company_id: companyId,
    p_document_type: documentType,
  });

  if (error) {
    console.error(`Could not allocate ${documentType} number:`, error.message);
    throw new ApiError(500, 'A document number could not be allocated.');
  }

  return data;
}
