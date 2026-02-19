import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${supabaseUrl}/rest/v1/`,
    prepareHeaders: (headers) => {
      headers.set("apikey", supabaseKey);
      headers.set("Authorization", `Bearer ${supabaseKey}`);
      headers.set("Accept", "application/json");
      return headers;
    },
  }),
  tagTypes: ["Products"],
  endpoints: (builder) => ({
    getProducts: builder.query({
      query: () => "products?select=*&order=created_at.desc",
      providesTags: ["Products"],
    }),

    addProduct: builder.mutation({
      query: (body) => ({
        url: "products",
        method: "POST",
        body,
        headers: { Prefer: "return=representation" },
      }),
      invalidatesTags: ["Products"],
    }),

    updateProduct: builder.mutation({
      query: ({ id, patch }) => ({
        url: `products?id=eq.${id}`,
        method: "PATCH",
        body: patch,
        headers: { Prefer: "return=representation" },
      }),
      invalidatesTags: ["Products"],
    }),

    deleteProduct: builder.mutation({
      query: (id) => ({
        url: `products?id=eq.${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Products"],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useAddProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} = authApi;
