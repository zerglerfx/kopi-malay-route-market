import { queryOptions } from "@tanstack/react-query";
import { getCategories, getProduct, getProducts } from "./shop.functions";

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
  staleTime: 5 * 60_000,
});

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: () => getProducts(),
  staleTime: 60_000,
});

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: () => getProduct({ data: { slug } }),
    staleTime: 60_000,
  });
